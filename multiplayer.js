/**
 * Multiplayer management for StackAttack using PeerJS.
 */
window.Multiplayer = (function() {
  let peer = null;
  let conn = null;
  let game = null;
  let peerId = "Loading...";

  const UI = {
    idDisplay: null,
    joinInput: null,
    connectBtn: null,
    turnIndicator: null
  };

  function init(gameInstance) {
    game = gameInstance;
    UI.idDisplay = document.getElementById('peer-id-display');
    UI.joinInput = document.getElementById('join-id-input');
    UI.connectBtn = document.getElementById('connect-btn');
    UI.turnIndicator = document.getElementById('turn-indicator');

    // Simple short ID generator
    const shortId = Math.floor(1000 + Math.random() * 9000).toString();
    peer = new Peer(shortId);

    peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      peerId = id;
      UI.idDisplay.textContent = 'ID: ' + id;
      UI.idDisplay.style.cursor = 'pointer';
      UI.idDisplay.title = 'Click to copy';
      UI.idDisplay.onclick = () => {
        navigator.clipboard.writeText(id);
        const oldText = UI.idDisplay.textContent;
        UI.idDisplay.textContent = 'Copied!';
        setTimeout(() => UI.idDisplay.textContent = oldText, 2000);
      };
      if (game && game.menuOpen && game.menuView === "pvp" && game.renderMainMenu) {
        game.renderMainMenu("pvp");
      }
    });

    peer.on('connection', (connection) => {
      if (game && game.canStartPvpDraft && !game.canStartPvpDraft()) {
        game.logEvent({ type: 'error', msg: `PvP needs at least ${game.minimumPvpCards || 16} owned cards.` });
        connection.close();
        if (game.renderMainMenu) game.renderMainMenu("pvp");
        return;
      }
      if (conn) {
        connection.close();
        return;
      }
      setupConnection(connection);
      // We are the host (Player team)
      game.isMultiplayer = true;
      game.playerTeam = Config.TEAM.PLAYER;
      UI.connectBtn.textContent = 'Connected (Host)';
      UI.connectBtn.disabled = true;
      UI.joinInput.style.display = 'none';
      game.updateHUD();
      game.renderEntities();
      
      // Send initial state sync (terrain, base positions)
      // We wait for the connection to be fully open before sending
      connection.on('open', () => {
        setTimeout(() => {
          sendPacket('SYNC_STATE', { 
      terrain: game.terrain,
      nexusOwners: game.nexusOwners,
      biomes: game.biomes,
      basePositions: game.entities.filter(e => e.kind === 'base').map(e => ({ team: e.team, r: e.row, c: e.col }))
    });
          game.startDraft('pvp', { firstTeam: Config.TEAM.PLAYER });
        }, 500);
      });
    });

    UI.connectBtn.onclick = () => {
      const targetId = UI.joinInput.value.trim();
      connectTo(targetId);
    };
  }

  function connectTo(targetId) {
      if (!targetId) return;
      if (game && game.canStartPvpDraft && !game.canStartPvpDraft()) {
        game.logEvent({ type: 'error', msg: `PvP needs at least ${game.minimumPvpCards || 16} owned cards.` });
        if (game.renderMainMenu) game.renderMainMenu("pvp");
        return;
      }
      const connection = peer.connect(targetId);
      setupConnection(connection);
      // We are the guest (AI team, but we'll treat it as Player 2)
      game.isMultiplayer = true;
      game.playerTeam = Config.TEAM.AI;
      applySecondPlayerBonus();
      UI.connectBtn.textContent = 'Connecting...';
      game.updateHUD();
      game.renderEntities();
  }

  function setupConnection(connection) {
    conn = connection;
    conn.on('open', () => {
      console.log('Connected to: ' + conn.peer);
      UI.connectBtn.textContent = 'Connected';
      UI.connectBtn.disabled = true;
      UI.joinInput.style.display = 'none';
      game.logEvent({ type: 'status', msg: 'PvP Connection Established!' });
      updateTurnIndicator();
      if (game && game.menuOpen && game.renderMainMenu) game.renderMainMenu("pvp");
    });

    conn.on('data', (data) => {
      handlePacket(data);
      updateTurnIndicator();
    });

    conn.on('close', () => {
      game.logEvent({ type: 'error', msg: 'PvP Connection Closed.' });
      game.isMultiplayer = false;
      location.reload(); // Simplest way to reset
    });
  }

  function updateTurnIndicator() {
    if (!UI.turnIndicator || !game) return;
    const isMyTurn = game.turn === game.playerTeam;
    UI.turnIndicator.textContent = isMyTurn ? "YOUR TURN" : "ENEMY TURN";
    UI.turnIndicator.className = isMyTurn ? "turn turn-player" : "turn turn-enemy";
  }

  function sendPacket(type, payload) {
    if (!conn || !conn.open) return;
    conn.send({ type, payload });
  }

  function handlePacket(packet) {
    const { type, payload } = packet;
    console.log('Received packet:', type, payload);

    switch (type) {
      case 'SYNC_STATE':
        game.syncState(payload);
        game.logEvent({ type: 'status', msg: 'Game Synced with Host' });
        break;
      case 'MOVE':
        executeMove(payload);
        break;
      case 'ATTACK':
        executeAttack(payload);
        break;
      case 'ABILITY':
        executeAbility(payload);
        break;
      case 'END_TURN':
        executeEndTurn();
        break;
      case 'BUY':
        executeBuy(payload);
        break;
      case 'BUY_RUNE':
        executeBuyRune(payload);
        break;
      case 'DRAFT_START':
        game.startDraft('pvp', { firstTeam: payload.firstTeam, pickCount: payload.pickCount, remote: true });
        break;
      case 'DRAFT_PICK':
        game.applyRemoteDraftPick(payload);
        break;
      case 'CHAT':
        game.logEvent({ type: 'status', msg: `Enemy: ${payload.msg}` });
        break;
    }
  }

  // Remote Execution Helpers
  async function executeMove(p) {
    const u = game.occupants[p.fromR][p.fromC];
    if (!u) return;
    const path = game.getMovePath(u, p.toR, p.toC, 99);
    if (path) {
      await game.animateMove(u, path, { dash: false });
      u.ap = p.ap;
    } else {
      game.moveUnit(u, p.toR, p.toC);
      u.ap = p.ap;
    }
    game.renderEntities();
    game.updateUnitPanel(game.selected);
  }

  function executeAttack(p) {
    const u = game.occupants[p.fromR][p.fromC];
    const target = game.occupants[p.toR][p.toC] || game.entities.find(e => e.kind === 'base' && e.row === p.toR && e.col === p.toC);
    if (u && target) {
      game.attack(u, target);
      u.ap = p.ap;
      game.renderEntities();
      game.updateUnitPanel(game.selected);
    }
  }

  function executeAbility(p) {
    const u = game.occupants[p.fromR][p.fromC];
    if (!u) return;
    const abil = window.Abilities[u.type].find(a => a.name === p.abilityName);
    if (abil) {
      if (p.targetTiles) {
        abil.perform(game, u, p.targetTiles);
      } else {
        abil.perform(game, u, p.targetR, p.targetC);
      }
      u.ap = p.ap;
      game.renderEntities();
      game.updateUnitPanel(game.selected);
    }
  }

  function executeEndTurn() {
    // Force end of opponent's turn
    if (game.turn !== game.playerTeam) {
      game.endTurnPvP();
    }
  }

  function executeBuy(p) {
    const u = game.spawnUnitNearBase(p.team, p.unitType, p.r, p.c);
    if (u) {
      game.energy[p.team] = p.energy;
      game.updateHUD();
    }
  }

  function executeBuyRune(p) {
    const u = game.occupants[p.fromR][p.fromC];
    if (u) {
      game.buyRune(u, p.runeId);
    }
  }

  return {
    init,
    sendPacket,
    connectTo,
    getPeerId: () => peerId,
    isConnected: () => !!(conn && conn.open)
  };
})();
