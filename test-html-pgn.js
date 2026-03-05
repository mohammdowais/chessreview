const https = require('https');

https.get('https://www.chess.com/game/live/165548711762', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // we want to search for "pgn" inside the HTML or initial state
        const match = data.match(/"pgn":"(.*?)"/);
        if (match) {
            console.log("PGN FOUND! (escaped length):", match[1].length);
            console.log("Snippet:", match[1].substring(0, 100));
        } else {
            console.log("No pgn match found in HTML");
        }
    });
});
