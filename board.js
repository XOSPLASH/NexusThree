// Board: manages the 10x10 clickable cells and highlights
class Board {
  constructor(rows, cols, mountEl) {
    this.rows = rows;
    this.cols = cols;
    this.mountEl = mountEl;
    this.cells = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.render();
  }

  render() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute("aria-label", `Cell ${r}, ${c}`);
        this.cells[r][c] = cell;
        frag.appendChild(cell);
      }
    }
    this.mountEl.innerHTML = "";
    this.mountEl.appendChild(frag);
  }

  getCell(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.cells[row][col];
  }

  clearMarks() {
    this.forEachCell(cell => {
      cell.classList.remove("selected", "move-hl", "attack-hl", "heal-hl", "ability-hl", "attack-range-hl", "selected-player", "selected-enemy", "selected-empty", "buy-hl");
    });
  }

  markSelected(row, col) {
    const cell = this.getCell(row, col);
    if (cell) cell.classList.add("selected");
  }

  markPositions(positions, className) {
    positions.forEach(([r, c]) => {
      const cell = this.getCell(r, c);
      if (cell) cell.classList.add(className);
    });
  }

  forEachCell(callback) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        callback(this.cells[r][c], r, c);
      }
    }
  }
}
window.Board = Board;
