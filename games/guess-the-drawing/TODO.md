# TODO

## Bugs
- [ ] Rainbow is upside down - need to fix the arc direction in paths.js

## Improvements
- [ ] Auto-enable microphone at the start of each round instead of requiring manual click each time
- [ ] Add tutorial/instructions screen at the beginning explaining how to play
- [ ] Improve voice recognition accuracy - "hat" often misheard as "hot"
  - Consider adding phonetically similar words to acceptedAnswers
  - Or use fuzzy matching for close words

## Multiplayer
- [ ] Add multiplayer mode where multiple players can compete
  - Take turns guessing
  - Track scores for each player
  - Could use WebSockets for real-time multiplayer

## Content
- [ ] Generate 100 new picture definitions to add variety
  - Current drawings: house, tree, rainbow, sun, star, heart, flower, ball, flag, hat
  - Ideas: car, boat, cat, dog, fish, bird, apple, banana, pizza, ice cream, bicycle, airplane, rocket, moon, cloud, umbrella, book, phone, guitar, piano, clock, key, shoe, shirt, pants, glasses, camera, pencil, scissors, hammer, etc.
- [ ] Make drawings more detailed and realistic
  - Add more path segments/steps to each drawing
  - Include shading or detail lines
  - Make objects more recognizable earlier in the animation

## Deployment
- [x] Host the game publicly on Cloudflare Workers
  - Live at: https://gtd.kukulinski.com
  - Auto-deploys from GitHub via Cloudflare Workers integration
  - Build command: `npm run build`
  - Deploy command: `npm run deploy`
