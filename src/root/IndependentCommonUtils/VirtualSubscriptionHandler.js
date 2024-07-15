const CommonUtils = require('./CommonUtils')
const {subscribeList, unsubscribeList} = require('./SubscribeList')
const Event = CommonUtils.Event

const subscriptionBook = new Map()
function subscribeVirtualPair(assetSymbol,
                              currencySymbol,
                              vanillaSubscriptionFunction,
                              exchange,
                              staticInfo,
                              callback)
{
    const key = JSON.stringify([assetSymbol, currencySymbol, exchange])
    let matter = subscriptionBook.get(key)
    if (undefined === matter) {
        const priceEvt = new Event()
        matter =
        {
            callback    :   (prices) => {
                                const [assetSymbolPrice, currencySymbolPrice] = prices
                                priceEvt.raise({...staticInfo, price : assetSymbolPrice/currencySymbolPrice})
                            },
            evt         :   priceEvt
        }

        subscribeList([assetSymbol, currencySymbol], exchange, vanillaSubscriptionFunction, matter.callback)
        subscriptionBook.set(key, matter)
    }

    try {
        matter.evt.registerCallback(callback)
    } catch(err) {
        throw new Error(`This callback is already registered for the key: ${key}`)
    }
}

function unsubscribeVirtualPair(assetSymbol,
                                currencySymbol,
                                vanillaUnsubscriptionFunction,
                                exchange,
                                callback)
{
    const key = JSON.stringify([assetSymbol, currencySymbol, exchange])
    let matter = subscriptionBook.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    try {
        matter.evt.unregisterCallback(callback)
    } catch(err) {
        throw new Error(`This callback is not registered for the key: ${key}`)
    }

    if (matter.evt.empty()) {
        unsubscribeList([assetSymbol, currencySymbol],
                        exchange,
                        vanillaUnsubscriptionFunction,
                        matter.callback)
        subscriptionBook.delete(key)
    }
}

module.exports.subscribeVirtual = subscribeVirtualPair
module.exports.unscribeVirtual = unsubscribeVirtualPair