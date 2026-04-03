## Game and project name

Seas of strife

## Technologies for implementation

Backend / server: Bun + websocket
Frontend / browser: React + Vite + CSS animations + WebSocket

## Requirements

A browser game compatible with most modern browsers.
Background of field: transparent sea pattern that would co-exist with cards on the field.

Maximum amount of real players - 6. Minumum amount of real players - 1. Remaining places are occupied by bots.

## Log in

It is the very first screen (if a user is not logged in yet).

First every user should login by typing a login and password. Login will be used in the game to display info about a player. Password should be hashed with salt and stored in the database. If user logs in but no such user (by login) exists - create a new one with the specified password. For the already existing user password has always match to log a user in.

Logged in user session is stored in browser (how basic auth works). Session should be valid only within the same browser window. If the new browser window is open - the session should not be available there and user should log in again.

After authentication user will be forwarded to the main screen.

## Starting or joining a game on the main screen

The main screen is the second screen with the 4 items as a list on the center of the screen (keep letters case as-is):
- New Game
- Join Game
- Profile
- Log out

Above them should be "S.O.S." abbreviature with a game-alike (e.g. Doom) style.

When create a new game:
1. User presses 'new game' button (or icon)
3. User waits until required amount of players join. Any time the creator of a game can press button 'start'. If there are less than 4 players joined then remaining places will be occupied by bots. If there is one player joined (creator) then other 3 will be bots. For example, if 3 people joined then 1 bot will participate in the game. It is possible to join to up to 6 real players.

Creator can stop the game and all players will be redirected to the main screen.

When join an existing game:
1. User presses 'join' button (or icon)
2. User types the identifier of the game. Identifier should be a number that uniquely identifies the game among other possible existing games.
3. User joins the game and waits until either creator presses 'start' or defined for the game amount of players join.

User anytime can leave a game and go to the main screen. 

## Profile

Profile should be accessible from the main screen. Profile should contain:
- Results of previous games (including all real players who played)
- Name / login of the user
- Amount of gold medals (times when user won 1st place)
- Amount of silver medals (times when user won 2nd place)
- Amount of bronze medals (times when user won 3d place)

Medals should be displayed in a row.

## Handling reconnections

When reconnects, user should be able to see the current state of the game. As the game is sequential there should be timeout how much to wait until players returns to the game or makes a move. If player does not return or makes a move within a timeout (30 seconds) then a random but allowed card is applied from user's hand.

## Local testing

Frontend, backend, postgresql and possible caches should be able to run locally to test the whole game.
For the client state should be different for a new browser window. However if player is already logged in with a login, the same login can not be used at the same time.