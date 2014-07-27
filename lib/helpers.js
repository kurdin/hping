Array.max = function(array) {
  return Math.max.apply(Math, array);
};

Array.min = function(array) {
  return Math.min.apply(Math, array);
};

Array.prototype.range = function() {

  var min = null,
    max = null,
    sum = null,
    i, len;

  for (i = 0, len = this.length; i < len; ++i) {
    var elem = this[i];
    sum += elem;
    if (min === null || min > elem) min = elem;
    if (max === null || max < elem) max = elem;
  }

  return {
    min: min,
    max: max,
    avg: Math.floor(sum / len),
    len: len
  };
};

Math.floor10 = function(value) {
  return decimalAdjust('floor', value, -1);
};

function decimalAdjust(type, value, exp) {
  if (typeof exp === 'undefined' || +exp === 0) {
    return Math[type](value);
  }
  value = +value;
  exp = +exp;
  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
  }
  value = value.toString().split('e');
  value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
  value = value.toString().split('e');
  return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}