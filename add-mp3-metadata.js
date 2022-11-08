'use strict';
let fs = require('fs');
let { execSync } = require('child_process');

let prefix = 'Album Example - Artist Example - ';
let artist = 'Artist Example';
let album = 'Album Example';

for (let file of fs.readdirSync('.')) {
  if (!file.endsWith('.mp3')) {
    continue;
  }
  console.log(file);
  let name = file.match(/[0-9][0-9] (.*)\.mp3/)[1];
  let unprefixed = file.substring(prefix.length);
  execSync(`ffmpeg -i "${file}" -i "./cover.jpg" -map 0:0 -map 1:0 -c copy -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" -metadata title="${name}" -metadata artist="${artist}" -metadata album="${album}" out/"${unprefixed}" `, { stdio: 'inherit' });
}
