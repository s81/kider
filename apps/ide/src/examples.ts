// examples.ts — starter programs for the Examples dropdown.
//
// Every program here is parsed and interpreted in tests/examples.test.ts,
// so the gallery doubles as an end-to-end regression suite: a language
// change that breaks a shipped example fails CI.

export interface Example {
  name: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: 'Square',
    code: `# A square: four sides, four turns
repeat 4 do
  forward(100)
  turn(90)
end`,
  },
  {
    name: 'Filled Star',
    code: `# Trace a star with the turtle, then fill it
color(:orange)
fill do
  repeat 5 do
    forward(150)
    turn(144)
  end
end
hideTurtle()`,
  },
  {
    name: 'Random Art',
    code: `# Confetti! Random circles in random colors
repeat 30 do
  randomColor()
  goto(random(-200, 200), random(-200, 200))
  circle(random(5, 30))
end
home()`,
  },
  {
    name: 'Melody',
    code: `# Twinkle, twinkle, little star
playNote("C4", 0.4)
playNote("C4", 0.4)
playNote("G4", 0.4)
playNote("G4", 0.4)
playNote("A4", 0.4)
playNote("A4", 0.4)
playNote("G4", 0.8)`,
  },
  {
    name: 'Catch Game',
    code: `# Catch the circle! Arrow keys to move. Catch 5 to win.
let x = 0
let y = 0
let targetX = random(-200, 200)
let targetY = random(-200, 200)
let score = 0

on timer every 50 do
  if keyDown(:left) do
    set x = x - 5
  end
  if keyDown(:right) do
    set x = x + 5
  end
  if keyDown(:up) do
    set y = y - 5
  end
  if keyDown(:down) do
    set y = y + 5
  end

  if touching(x, y, targetX, targetY, 25) do
    beep()
    set score = score + 1
    set targetX = random(-200, 200)
    set targetY = random(-200, 200)
  end

  clearCanvas()
  goto(targetX, targetY)
  color(:red)
  circle(15)
  goto(x, y)
  show("score", score)

  if score == 5 do
    text("YOU WIN!", 40)
    stopTimer()
  end
end`,
  },
  {
    name: 'Sprite Chase',
    code: `# Catch the mouse! Arrow keys. Catch 5 to win.
hideTurtle()
sprite("cat", text("🐱", 40))
sprite("mouse", text("🐭", 30))
gotoSprite("mouse", random(-200, 200), random(-200, 200))
let score = 0

on timer every 50 do
  if keyDown(:left) do
    changeSpriteX("cat", -5)
  end
  if keyDown(:right) do
    changeSpriteX("cat", 5)
  end
  if keyDown(:up) do
    changeSpriteY("cat", -5)
  end
  if keyDown(:down) do
    changeSpriteY("cat", 5)
  end

  if spritesTouching("cat", "mouse") do
    beep()
    set score = score + 1
    gotoSprite("mouse", random(-200, 200), random(-200, 200))
  end

  show("score", score)

  if score == 5 do
    text("YOU WIN!", 40)
    stopTimer()
  end
end`,
  },
];
