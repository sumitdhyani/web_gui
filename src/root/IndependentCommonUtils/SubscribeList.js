const CommonUtils = require('./CommonUtils')
const Event = CommonUtils.Event

let subscriptionBook = new Map()
function subscribeList(symbols, exchange, vanillaSubscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    let matter = subscriptionBook.get(key)
    if (undefined === matter) {
        const symbolToIndex = new Map()
        symbols.forEach((symbol, index)=>{
            symbolToIndex.set(symbol, index)
        })

        const prices = new Array(symbols.length).fill(null)
        const priceEvt = new Event()
        let allUpdatesReceived = false;
        matter =
        {
            listUpdator : update=>{
                            prices[symbolToIndex.get(update.symbol)] = update.price
                            allUpdatesReceived =
                            allUpdatesReceived? true:
                                prices.reduce((prev, price)=> {
                                    return prev && (price !== null)
                                },true)
                            
                            if(allUpdatesReceived) {
                                priceEvt.raise(prices)
                            }
                          },
            evt         : priceEvt
        }

        symbols.forEach(symbol => {
            vanillaSubscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        subscriptionBook.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}

function unsubscribeList(symbols, exchange, vanillaUnsubscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    const matter = subscriptionBook.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        symbols.forEach(symbol=>{
            vanillaUnsubscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        subscriptionBook.delete(key)
    }
}

module.exports.subscribeList = subscribeList
module.exports.unsubscribeList = unsubscribeList