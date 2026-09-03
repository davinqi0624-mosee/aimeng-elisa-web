import { fit4PL } from '../lib/elisa-4pl-core.ts'

const screenshotStandards = {
  x: [0, 125, 250, 500, 1000, 2000, 4000, 8000],
  y: [0.0717, 0.178, 0.257, 0.378, 0.606, 0.919, 1.469, 2.216],
}

const result = fit4PL(screenshotStandards.x, screenshotStandards.y)

console.log(JSON.stringify({
  A: result.A,
  B: result.B,
  C: result.C,
  D: result.D,
  r2: result.r2,
  yPredicted: result.yPredicted,
}, null, 2))

if (result.r2 < 0.999) {
  throw new Error(`Expected screenshot data 4PL R2 >= 0.999, got ${result.r2}`)
}
