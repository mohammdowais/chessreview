const sf = require("stockfish.js");
console.log("Type of sf:", typeof sf);

if (typeof sf === 'function') {
    const engine = sf();
    console.log("engine keys:", Object.keys(engine));
    engine.postMessage = engine.postMessage || engine.stdin || (() => { });
} else {
    sf().then(engine => {
        engine.onmessage = msg => console.log(msg);
        engine.postMessage("uci");
        engine.postMessage("quit");
    }).catch(e => console.log(e));
}
