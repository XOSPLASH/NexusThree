const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.window = global;
global.document = {
  createDocumentFragment: () => ({ appendChild: () => {} }),
  createElement: () => ({
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {},
    setAttribute: () => {},
    addEventListener: () => {},
    appendChild: () => {}
  }),
  getElementById: () => ({
    innerHTML: "",
    appendChild: () => {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    querySelector: () => ({ textContent: "", classList: { remove: () => {} }, addEventListener: () => {} })
  }),
  body: { appendChild: () => {} }
};
global.AudioContext = class {
  createOscillator() { return { connect: () => ({ connect: () => {} }), start: () => {}, stop: () => {}, disconnect: () => {}, frequency: { value: 0 }, type: "" }; }
  createGain() { return { gain: { value: 0 }, disconnect: () => {} }; }
  destination = {};
};

// Mock location
global.location = { reload: () => {} };

// Load Scripts
const loadScript = (name) => {
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    eval(content);
  } catch (e) {
    console.error(`Error loading ${name}:`, e);
  }
};

loadScript('config.js');
loadScript('board.js');
loadScript('entities.js');
// Load Abilities
loadScript('abilities/mage.js');
loadScript('abilities/paladin.js');
// Load Game
loadScript('game.js');

// Test Case
console.log("Starting Stun Logic Test...");

const board = new window.Board(10, 10, document.getElementById('grid'));
const game = new window.Game(board);

// Setup Units
const playerMage = window.Entities.makeUnit(window.Config.TEAM.PLAYER, "Mage", 5, 5);
const aiUnit = window.Entities.makeUnit(window.Config.TEAM.AI, "Paladin", 5, 6); // Close enough for Frostbolt

game.entities = [playerMage, aiUnit];
game.occupants[5][5] = playerMage;
game.occupants[5][6] = aiUnit;

console.log(`Initial AI AP: ${aiUnit.ap}`);
console.log(`Initial AI Stun: ${aiUnit.stunnedTurns}`);

// Cast Frostbolt
console.log("Casting Frostbolt on AI Unit...");
const frostbolt = window.Abilities.Mage[0];
frostbolt.perform(game, playerMage, 5, 6);

console.log(`Post-Frostbolt AI AP: ${aiUnit.ap} (Expected: 0)`);
console.log(`Post-Frostbolt AI Stun: ${aiUnit.stunnedTurns} (Expected: >=1)`);

if (aiUnit.ap !== 0) console.error("FAIL: AP not drained.");
if (aiUnit.stunnedTurns < 1) console.error("FAIL: Stun not applied.");

// Reset AP for AI Team (Turn Start)
console.log("Simulating AI Turn Start (Reset AP)...");
game.resetAPForTeam(window.Config.TEAM.AI);

console.log(`Turn 1 AI AP: ${aiUnit.ap} (Expected: 0)`);
console.log(`Turn 1 AI Stun: ${aiUnit.stunnedTurns} (Expected: 0 - decremented)`);

if (aiUnit.ap !== 0) console.error("FAIL: AP should remain 0 for stunned unit.");
if (aiUnit.stunnedTurns !== 0) console.error("FAIL: Stun turns should decrement.");

// Reset AP again (Next Turn)
console.log("Simulating Next Turn Start...");
game.resetAPForTeam(window.Config.TEAM.AI);

console.log(`Turn 2 AI AP: ${aiUnit.ap} (Expected: Max)`);
if (aiUnit.ap === 0) console.error("FAIL: AP should recover.");

console.log("Stun Logic Verified.");

// Test runAI with Stunned Unit
console.log("Testing runAI with Stunned Unit...");
aiUnit.ap = 0; // Stunned
aiUnit.stunnedTurns = 0; 

// Mock delay to be instant
game.delay = () => Promise.resolve();

game.runAI().then(() => {
  console.log("runAI completed successfully (No Crash).");
}).catch(err => {
  console.error("runAI Crashed:", err);
});
