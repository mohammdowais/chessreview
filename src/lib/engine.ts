export class ChessEngine {
    private worker: Worker | null = null;
    private isReady = false;
    private messageCallbacks: ((msg: string) => void)[] = [];

    constructor(engineUrl: string = "/stockfish.js") {
        if (typeof window !== "undefined") {
            // Load engine script from provided URL
            this.worker = new Worker(engineUrl);

            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg === "readyok") {
                    this.isReady = true;
                }
                // notify all listeners
                this.messageCallbacks.forEach(cb => cb(msg));
            };

            // initialize
            this.sendCommand("uci");
            this.sendCommand("setoption name MultiPV value 1"); // Default to 1
        }
    }

    public sendCommand(cmd: string) {
        if (this.worker) {
            this.worker.postMessage(cmd);
        }
    }

    public addMessageListener(cb: (msg: string) => void) {
        this.messageCallbacks.push(cb);
    }

    public removeMessageListener(cb: (msg: string) => void) {
        this.messageCallbacks = this.messageCallbacks.filter(c => c !== cb);
    }

    public async getEvaluation(fen: string, depth = 15, movetime?: number, multiPv = 1): Promise<{ evalScore: number; bestMove: string }> {
        return new Promise((resolve) => {
            let currentBestMove = "";
            let currentScore = 0; // Centipawns or Mate

            const listener = (msg: string) => {
                // Parse "info depth 15 ... score cp 35 ... pv e2e4"
                if (msg.includes("info depth")) {
                    const depthMatch = msg.match(/depth (\d+)/);
                    const cpMatch = msg.match(/score cp (-?\d+)/);
                    const mateMatch = msg.match(/score mate (-?\d+)/);

                    if (cpMatch) {
                        currentScore = parseInt(cpMatch[1], 10) / 100.0;
                        // if black is to move, invert the score to always remain absolute (White advantage = positive)
                        if (fen.includes(" b ")) {
                            currentScore = -currentScore;
                        }
                    } else if (mateMatch) {
                        const mateIn = parseInt(mateMatch[1], 10);
                        currentScore = mateIn > 0 ? 10.0 : -10.0;
                        if (fen.includes(" b ")) currentScore = -currentScore;
                    }
                }

                if (msg.includes("bestmove")) {
                    const parts = msg.split(" ");
                    currentBestMove = parts[1] || "";

                    // Cleanup
                    this.removeMessageListener(listener);
                    resolve({ evalScore: currentScore, bestMove: currentBestMove });
                }
            };

            this.addMessageListener(listener);

            this.sendCommand("ucinewgame");
            this.sendCommand(`setoption name MultiPV value ${multiPv}`);
            this.sendCommand(`position fen ${fen}`);

            if (movetime) {
                this.sendCommand(`go movetime ${movetime}`);
            } else {
                this.sendCommand(`go depth ${depth}`);
            }
        });
    }

    public destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
