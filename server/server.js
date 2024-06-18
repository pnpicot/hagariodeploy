const { CONFIG } = require('../shared/constants');

const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { kill } = require('process');
const port = process.env.PORT || 3000;
const staticFolders = ['client', 'shared'];

let app = express();
let server = http.createServer(app);
let io = socketIO(server);

const {
    createPlayer,
    deletePlayer,
    updatePlayerDirection,
    serverUpdate,
    playerAteFood,
    playerAtePlayer,
    playerSplit,
    playerAteVirus,
    playerShare
} = require('./serverCore')(CONFIG, io);

staticFolders.forEach((folder) => {
    app.use(express.static(path.join(__dirname, `/../${folder}`)));
});

server.listen(port, () => {
    console.log(`Server started. Listening to port ${port}.`);

    serverUpdate();
});

io.on('connection', (socket) => {
    socket.on('createPlayer', (socketID, username) => {
        let success = createPlayer(socketID, username);

        if (!success)
            io.to(socketID).emit('serverFull');
    });

    socket.on('disconnect', () => {
        deletePlayer(socket.id);
    });

    socket.on('updatePlayerDirection', (socketID, newDir) => {
        updatePlayerDirection(socketID, newDir);
    });

    socket.on('playerAteFood', (socketID, foodID, massIdx) => {
        playerAteFood(socketID, foodID, massIdx);
    });

    socket.on('playerAtePlayer', (socketID, killedSocketID, eaterMassIdx, ateMassIdx) => {
        playerAtePlayer(socketID, killedSocketID, eaterMassIdx, ateMassIdx);
    });

    socket.on('playerSplit', (socketID, mousePos, centerPos) => {
        playerSplit(socketID, mousePos, centerPos);
    });

    socket.on('playerAteVirus', (socketID, virus) => {
        playerAteVirus(socketID, virus);
    });

    socket.on('playerShare', (socketID, mousePos, centerPos) => {
        playerShare(socketID, mousePos, centerPos);
    });
});