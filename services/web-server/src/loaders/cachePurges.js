const sift = require('sift').default;
const ConnectionLoader = require('../ConnectionLoader');

module.exports = ({ purgeCache }) => {
  const cachePurges = new ConnectionLoader(async ({ filter, options }) => {
    const raw = await purgeCache.allPurgeRequests(options);

    return {
      ...raw,
      items: filter ? sift(filter, raw.requests) : raw.requests,
    };
  });

  return {
    cachePurges,
  };
};
