/*
 *  This is a fix for this stupid bug: https://github.com/webpack/webpack/issues/2168
 */

'use strict';

module.exports = function(source) {
  return source.replace('#! /usr/bin/env node', '');
};
