const https = require('https');

https.get('https://www.chess.com/callback/live/game/165548711762', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("MoveList type:", typeof json.game.moveList);
            if (typeof json.game.moveList === 'string') {
                console.log("MoveList content:", json.game.moveList.substring(0, 100));
            } else {
                console.log("MoveList content:", json.game.moveList);
            }
            if (json.game.pgnHeaders) {
                console.log("pgnHeaders content:", json.game.pgnHeaders);
            }
        } catch (e) {
            console.log(e);
        }
    });
});
