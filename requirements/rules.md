## Cards

in total 60 cards in 8 different colors (suits) with the following values:
- Orange (doldrums): 0 - 10
- Red (reef): 11 - 20
- Gray (fog): 21 - 29
- Blue (iceberg): 31 - 38
- Green (rocks): 41 - 47
- Purple (storm): 51 - 56
- Teal (whirlpool): 61 - 65
- Dark Red (kraken): 71 - 74

User can see their cards. Cards of other players should be hidden from the current player. However players should have a representation how many players play. Player names (logins) should be displayed above every player hand.

## Card Anatomy

Every card should have:
- Number on the top left corner. It should has a big enough font size and white color. Background is rectangular of color similar to the card color/suit.
- Suit icon below number. Width should be similar to the element above width. Take icon from the folder ../images/suits. Every file name is related to a card color. File names have snack_case notation.
- The number of flags below suit icon. Indicates how many cards there are of this color. Flag direction is from the left to right. The flag related to a current card should be drawn longer and has a white color. Other flags color should be equal to the card color/suit.
- Background. Take it from ../images/bg folder with a proper size that would fit to the browser window and match to the aforementioned elements. For every color there is a related file with similar name and .png extension.

## Game setup

Cards are shuffled before every round. Every new round player takes theird cards into their hand. For 4 players each player should have 15 cards; 5 players should have 12 cards each; 6 players should have 10 cards each.

## Rounds

The first round of every game should start the player who has a card with 0 value.

A round ends when 0 cards for each player remains.

At the end of every round amount of taken tricks per player is calculated. Amount of taken tricks are saved into results for every player. Statistics are scored during all rounds in a game. Amount of rounds to play - 5. This value should be configured in a config to easier change it.

At the end of every game the winner is the player with the fewest points (taken tricks). IF there is a tie, all tied players have won.

## Trick

In each trick (should be done sequentially), every player plays one card from hand with a similar suit matching to already played cards. Card should be put face up in the center of the table.

If the player's turn is first and no cards are played yet then a player can choose any card they want. If the player does not have a card of a matching suite on hand, any other card with other suite can be played. For real players it's up to them. Bot logic should be random but smart enough to imitate a human strategy.

Play proceeds clockwise from the starting player with other players each playing one card from their hands into the trick.

Once each player has played a card, player that played the card with a highest value takes all of the cards kist played, also called a "trick".

Who takes the trick? Once everyone played a card, the player who played the highest card of the tied colors takes the trick. When a player takes a trick, they put all cards in that trick in front of them in a single face-down pile. They put any subsequent tricks that they take in separate piles, so all players can easily see how many tricks each player has taken at any time during the round.

The goall of the game is to take the fewest tricks each round, so it' worth to avoid playing the highest card as much as it is possible.

## Trick examples

### Example 1

a. Anna starts the first trick of the round by playing the orange
(doldrums) 0 card.
b. Beth must play an orange card if she has one, so she plays the orange 2 card.
c. Connor must follow suit, and he plays the orange 1 card.
d. David chooses to play the orange 6 card.
e. Eve has no orange cards, so she can play a card from a different suit. She chooses to play the green (rocks) 42 card.

Orange is the suit with the most cards in the trick, and the highest orange card played was a 6, so David takes the trick.

### Example 2

a. David starts the trick by playing the purple (storm) 53 card.
b. Eve must play a purple card if she has one, but she does not. So, she plays an 11, which belongs to the red (reef) suit.
c. Anna must now either play a purple (storm) or a red (reef) card, if possible. She decides to play the 13, which belongs to the red  (reef) suit.
d. Beth does not have a purple or a red card, so she chooses to play an orange (doldrums) 8 card.
e. Connor plays the purple (storm) 51 card.

Purple and red are tied with the same number of cards in the trick. In this case, the highest number played among the cards of the tied suits takes the trick. So, David must take the trick

## Who leads the next trick?

As a general rule, the player who takes a trick always opens the next one. That player may freely choose which card to play from their hand.

There is one exception, however: If a player takes a trick with the highest-ranked card of a particular suit, they may decide which player opens the next trick. They may, of course, pick themselves.

The cards that are the highest in each suit are easily recognizable. The color pattern on these cards is reversed (as shown on left), and they also feature a '*' in the rank flag on the sides of the card.