const https = require('https');

https.get('https://www.chess.com/callback/live/game/165548711762', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log("Keys:", Object.keys(json));
        if (json.game) {
            console.log("Game Keys:", Object.keys(json.game));
            console.log("moveList type:", typeof json.game.moveList);
            console.log("pgnHeaders:", json.game.pgnHeaders);
            if (typeof json.game.moveList === 'string') {
                console.log("moveList first 50 chars:", json.game.moveList.substring(0, 50));
            } else {
                console.log("moveList:", json.game.moveList);
            }
        }
    });
});
