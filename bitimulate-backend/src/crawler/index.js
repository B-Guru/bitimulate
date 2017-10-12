require('dotenv').config();
const db = require('db');
const poloniex = require('lib/poloniex');
const ExchangeRate = require('db/models/ExchangeRate');
const socket = require('./socket');
const { parseJSON, polyfill } = require('lib/common');
const log = require('lib/log');

const initialize = async () => {
  await db.connect();
  socket.connect();
};

async function registerInitialExchangeRate() {
  const tickers = await poloniex.getTickers();

  // removes all the data from the collection (only for temporary use)
  await ExchangeRate.drop();
  log('dropped exchangerate collection');
  const keys = Object.keys(tickers);
  const promises = keys.map(
    key => {
      const ticker = tickers[key];
      const data = Object.assign({name: key}, ticker);
      const exchangeRate = new ExchangeRate(data);
      return exchangeRate.save();
    }
  );

  try {
    await Promise.all(promises);
  } catch (e) {
    console.log(e);
  }

  console.log('succeed!');
}
async function updateEntireRate() {
  log('updating entire rate...');
  const tickers = await poloniex.getTickers();
  const keys = Object.keys(tickers);

  const promises = keys.map(
    key => {
      return ExchangeRate.updateTicker(key, tickers[key]);
    }
  );

  try {
    await Promise.all(promises);
  } catch (e) {
    log.error('Oops, failed to update entire rate!');
    return;
  }

  log('done');
}

const messageHandler = {
  1002: async (data) => {
    if (!data) return;
    const converted = poloniex.convertToTickerObject(data);
    const { name } = converted;
    const rest = polyfill.objectWithoutProperties(converted, 'name');
    
    try {
      await ExchangeRate.updateTicker(name, rest);
      log('Updated', name);
      // console.log('[Update]', name, new Date());
    } catch (e) {
      console.error(e);
    }
  }
};

socket.handleMessage = (message) => {
  const parsed = parseJSON(message);
  if (!parsed) {
    return null;
  }
  const [type, meta, data] = parsed;
  if (messageHandler[type]) {
    messageHandler[type](data);
  }
};

socket.handleRefresh = () => {
  updateEntireRate();
};

initialize();

// registerInitialExchangeRate();

// updateEntireRate();