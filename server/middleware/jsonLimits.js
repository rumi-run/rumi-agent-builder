const express = require('express');

/** Per-route JSON body limits to reduce abuse; large canvases only on agents (and AI assist). */
module.exports = {
  jsonAuth: express.json({ limit: '48kb' }),
  jsonSmall: express.json({ limit: '256kb' }),
  jsonMedium: express.json({ limit: '1mb' }),
  jsonAi: express.json({ limit: '2mb' }),
  jsonAgents: express.json({ limit: '10mb' }),
};
