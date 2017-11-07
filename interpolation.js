'use strict';

module.exports.interpolateOut = function(interpolation, value) {
  switch (interpolation.type) {
    case 'linear':
      value = linearInterpolateOut(interpolation, value);
      break;
    default:

  }
  return value;
}

module.exports.interpolateIn = function(interpolation, value) {
  switch (interpolation.type) {
    case 'linear':
      value = linearInterpolateIn(interpolation, value);
      break;
    default:

  }
  return value;
}

function linearInterpolateOut(interpolation, value) {
  return linearInterpolate(
    value,
    interpolation.eu[0],
    interpolation.eu[1],
    interpolation.raw[0],
    interpolation.raw[1]
  );
}

function linearInterpolateIn(interpolation, value) {
  return linearInterpolate(
    value,
    interpolation.raw[0],
    interpolation.raw[1],
    interpolation.eu[0],
    interpolation.eu[1]
  );
}

function linearInterpolate(value, x0, x1, y0, y1) {
  return y0 + (value - x0) * (y1 - y0) / (x1 - x0);
}
