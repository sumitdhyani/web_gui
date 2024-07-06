import './App.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { HorizontalTabs, VerticalTabsForVanillaPrices, SearchBoxRow, EditableDropdownRow, VerticalTabsForCrossPrices} from './CommonRenderingFunctions'
import { constants } from './root/ClientLayerLibrary/Constants'
function VanillaPricesTab(props){
    const context = props.context
    const subscription_functions = context.subscription_functions
    const [updateCount, setUpdateCount] = useState(0)

    const symbol_dict = context.symbol_dict
    
    const cache = useRef( (undefined !== context.cache)? new Map(context.cache.map(key=>[key, null])) : new Map() )
    const priceCallback = useCallback((update)=>{
        //console.log(`Update received: ${JSON.stringify(update)}`)
        cache.current.set(update.key, update)
        setUpdateCount(prev=>prev+1)
    },[])
   
    const tabsForDropDownRow = useRef([ {  title : "search",
                                    options : [...symbol_dict.keys()],
                                    onOptionSelected : (evt, instrumentKey) => {
                                        if (!instrumentKey) {
                                            return
                                        }
                                        const subscriptionKey = [...JSON.parse(instrumentKey), "depth"]
                                        const currCache = cache.current
                                        console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                        if (undefined === currCache.get(JSON.stringify(subscriptionKey))) {
                                            console.log(`Select Changed Handler, value: ${JSON.stringify(subscriptionKey)}`)
                                            try{
                                                subscription_functions.subscribe(...subscriptionKey, priceCallback)
                                            } catch (err) {
                                                console.log(`Error handled on subscription, caught, details : ${err.message}`)
                                            }
                                            console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                            currCache.set(JSON.stringify(subscriptionKey), null)
                                            setUpdateCount(prev=>prev+1)
                                        }
                                    }
                                  }
                                ])
    useEffect(()=>{
        console.log("Mounting Vanilla Prices Page")
        const arr = [...cache.current.keys()]
        arr.forEach(key=>{
            subscription_functions.subscribe(...JSON.parse(key), priceCallback)
        })

        const cacheInTheEnd = cache.current
        return ()=>{
            console.log("UnMounting Vanilla Prices Page")
            cacheInTheEnd.forEach((instrument, key)=>{
                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback)
            })
            context.cache = [...cacheInTheEnd.keys()]
        }
    },[])

    return (
            [<EditableDropdownRow   tabs = {tabsForDropDownRow.current}
                                    nameConverter = { key=> {
                                                      const [symbol, exchange] = JSON.parse(key)
                                                      return `${symbol} (${exchange})`
                                                    }}
                                    key = {0}
             />,
             <VerticalTabsForVanillaPrices  tabs = {[...cache.current.keys()].map(subscriptionKey=> {
                                                                    const [symbol, exchange, type] = JSON.parse(subscriptionKey)
                                                                    return {symbol : symbol_dict.get(JSON.stringify([symbol, exchange])).description,
                                                                            update : cache.current.get(subscriptionKey),
                                                                            user_unsubscribe_action : ()=>{
                                                                                const currCache = cache.current
                                                                                subscription_functions.unsubscribe(...JSON.parse(subscriptionKey), priceCallback)
                                                                                currCache.delete(subscriptionKey)
                                                                                setUpdateCount(prev=>prev+1)
                                                                            },
                                                                        }
                                                                    })
                                                    } 
                                            key={1}
            />
           ]
    )
}

function CrossPricesTabs(props){
    const context = props.context
    const subscription_functions = context.subscription_functions
    const symbol_dict = context.symbol_dict

    const [updateCount, setUpdateCount] = useState(0)
    const cache = useRef( (undefined !== context.cache)? new Map(context.cache.map(key=>[key, null])) : new Map() )
    const priceCallback = useCallback((update)=>{
        //console.log(`Update received: ${JSON.stringify(update)}`)
        cache.current.set(update.key, update)
        setUpdateCount(prev=>prev+1)
    },[])

    let assetSideAndCurrencySide = useRef([null, null])
    let [assetSide, currencySide] = assetSideAndCurrencySide.current

    const nameConverter = key=> {
        const [symbol, exchange] = JSON.parse(key)
        return `${symbol} (${exchange})`
    }
    const elementsForDropDownRow = useRef([ 
                                            {   widget_id : constants.widget_ids.editable_drop_down,
                                                title : "Asset Side",
                                                options : [...symbol_dict.keys()],
                                                onOptionSelected : (evt, key)=> {
                                                    if(key) {
                                                        assetSide = symbol_dict.get(key)
                                                    }
                                                },
                                                nameConverter : nameConverter
                                            },
                                            
                                            {   widget_id : constants.widget_ids.editable_drop_down,
                                                title : "Currency Side",
                                                options : [...symbol_dict.keys()],
                                                onOptionSelected : (evt, key)=> {
                                                    if (key) {
                                                        currencySide = symbol_dict.get(key)
                                                    }
                                                },
                                                nameConverter : nameConverter
                                            },

                                            {   widget_id : constants.widget_ids.button,
                                                title : "Select",
                                                onClick : ()=>{
                                                    if (!(assetSide && currencySide)) {
                                                        alert(`Please select both asset and currency side`)
                                                    } else if (assetSide.exchange !== currencySide.exchange) {
                                                        alert(`Both options should be from same exchange`)
                                                    } else if (assetSide.quoteAsset !== currencySide.quoteAsset) {
                                                        alert(`Both options should have same currency`)
                                                    } else {
                                                        const currCache = cache.current
                                                        const key = JSON.stringify([assetSide.baseAsset, currencySide.baseAsset, assetSide.quoteAsset, assetSide.exchange])
                                                        console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                                        if (undefined === currCache.get(key)) {
                                                            console.log(`Select Changed Handler, value: ${key}`)
                                                            try{
                                                                subscription_functions.subscribe(...JSON.parse(key), priceCallback)
                                                            } catch (err) {
                                                                console.log(`Error handled on subscription caught, details : ${err.message}`)
                                                            }
                                                            console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                                            currCache.set(key, null)
                                                            setUpdateCount(prev=>prev+1)
                                                        }
                                                    }
                                                }
                                            }
                                         ])
    useEffect(()=>{
        console.log("Mounting")
        cache.current.forEach((lastUpdate, key)=>{
            subscription_functions.subscribe(...JSON.parse(key), priceCallback)
        })

        const cacheInTheEnd = cache.current
        return ()=>{
            console.log("UnMounting")
            cacheInTheEnd.forEach((lastUpdate, key)=>{
                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback)
            })
            context.cache = [...cacheInTheEnd.keys()]
        }
    },[])

    return (
            [<HorizontalTabs    tabs={elementsForDropDownRow.current}
                                key={0}
             />,
             <VerticalTabsForCrossPrices  tabs={[...cache.current.keys()].map(key=> {
                                                                    return {symbol : key,
                                                                            update : cache.current.get(key),
                                                                            user_unsubscribe_action : ()=>{
                                                                                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback)
                                                                                const currCache = cache.current
                                                                                currCache.delete(key)
                                                                                setUpdateCount(prev=>prev+1)
                                                                            },
                                                                        }
                                                 })}
                                            key={1}/>
            ]
    )
}

function BasketPricesTab(props) {
    const context = props.context
    const subscription_functions = context.subscription_functions
    const symbol_dict = context.symbol_dict

    const [updateCount, setUpdateCount] = useState(0)
    const cache = useRef( (undefined !== context.cache)? new Map(context.cache.map(key=>[key, null])) : new Map() )
    const priceCallback = useCallback((update)=>{
        //console.log(`Update received: ${JSON.stringify(update)}`)
        cache.current.set(update.key, update)
        setUpdateCount(prev=>prev+1)
    },[])

    let selectedAsset = useRef(null)
    let selectedQty = useRef(null)
    let currAsset = selectedAsset.current
    let currQty = selectedQty.current

    const nameConverter = key=> {
        const item = symbol_dict.get(key)
        return `${item.symbol} (${item.exchange})` 
    }
    
    const elementsForDropDownRow = useRef([ {   widget_id : constants.widget_ids.editable_text_box,
                                                title : "Qty",
                                            },
                                            {   widget_id : constants.widget_ids.button,
                                                title : "+",
                                                onClick : ()=>{
                                                    if (currAsset) {
                                                        
                                                    }
                                                },
                                                options : [...symbol_dict.keys()],
                                                onOptionSelected : (evt, key)=> {
                                                    if(key) {
                                                        currAsset = symbol_dict.get(key)
                                                    }
                                                },
                                                nameConverter : nameConverter
                                            },
                                            {   widget_id : constants.widget_ids.editable_drop_down,
                                                title : "Asset",
                                                options : [...symbol_dict.keys()],
                                                onOptionSelected : (evt, key)=> {
                                                    if(key) {
                                                        currAsset = symbol_dict.get(key)
                                                    }
                                                },
                                                nameConverter : nameConverter
                                            }
                                            // ,
                                            // {   widget_id : constants.widget_ids.button,
                                            //     title : "Select",
                                            //     onClick : ()=>{
                                            //         if (!currAsset) {
                                            //             alert(`Please select atleast one asset both asset and currency side`)
                                            //         } else if (assetSide.exchange !== currencySide.exchange) {
                                            //             alert(`Both options should be from same exchange`)
                                            //         } else if (assetSide.quoteAsset !== currencySide.quoteAsset) {
                                            //             alert(`Both options should have same currency`)
                                            //         } else {
                                            //             const currCache = cache.current
                                            //             const key = JSON.stringify([assetSide.baseAsset, currencySide.baseAsset, assetSide.quoteAsset, assetSide.exchange])
                                            //             console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                            //             if (undefined === currCache.get(key)) {
                                            //                 console.log(`Select Changed Handler, value: ${key}`)
                                            //                 try{
                                            //                     subscription_functions.subscribe(...JSON.parse(key), "depth", priceCallback)
                                            //                 } catch (err) {
                                            //                     console.log(`Error handled on subscription caught, details : ${err.message}`)
                                            //                 }
                                            //                 console.log(`Old Cache: ${JSON.stringify([...currCache.keys()])}`)
                                            //                 currCache.set(key, null)
                                            //                 setUpdateCount(prev=>prev+1)
                                            //             }
                                            //         }
                                            //     }
                                            // }
                                            
                                         ])
    useEffect(()=>{
        console.log("Mounting")
        cache.current.forEach((lastUpdate, key)=>{
            subscription_functions.subscribe(...JSON.parse(key), "depth", priceCallback)
        })

        const cacheInTheEnd = cache.current
        return ()=>{
            console.log("UnMounting")
            cacheInTheEnd.forEach((lastUpdate, key)=>{
                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback)
            })
            context.cache = [...cacheInTheEnd.keys()]
        }
    },[])

    return (
            [<HorizontalTabs    tabs={elementsForDropDownRow.current}
                                key={0}
             />,
             <VerticalTabsForCrossPrices  tabs={[...cache.current.keys()].map(key=> {
                                                                    return {symbol : key,
                                                                            update : cache.current.get(key),
                                                                            user_unsubscribe_action : ()=>{
                                                                                subscription_functions.unsubscribe(...JSON.parse(key), priceCallback)
                                                                                const currCache = cache.current
                                                                                currCache.delete(key)
                                                                                setUpdateCount(prev=>prev+1)
                                                                            },
                                                                        }
                                                 })}
                                            key={1}/>
            ]
    )
}

function PricesPage(props){
    const [updateCount, setUpdateCount] = useState(0)

    const context = props.context
    const exchanges = context.exchanges
    function onTabSelected(tab){//Tab is an array: [Component For Tab, Its context]
        if(tab[0] !== context.curr_tab[0]){
            context.curr_tab = tab
            setUpdateCount(prev =>prev + 1)
        }
    }
    
    if(undefined === context.vanilla_prices ||
       undefined === context.cross_prices ||
       undefined === context.basket_prices)
    {
        context.vanilla_prices = 
        context.basket_prices = {subscription_functions : context.subscription_functions,
                                 symbol_dict : context.symbol_dict,
                                 exchanges : exchanges}

        context.cross_prices = {subscription_functions : context.virtual_subscription_functions,
                                symbol_dict : context.symbol_dict,
                                exchanges : exchanges}

        context.curr_tab = [VanillaPricesTab, context.vanilla_prices]
    }
    
    const [CurrComponent, currContext] = context.curr_tab
    return(<div>
                <HorizontalTabs tabs={[{title: "Vanilla Prices", onClick : ()=>{onTabSelected([VanillaPricesTab, context.vanilla_prices])}, widget_id : constants.widget_ids.button},
                                       {title: "Cross Prices", onClick : ()=>{onTabSelected([CrossPricesTabs, context.cross_prices])}, widget_id : constants.widget_ids.button},
                                       {title: "Baskets", onClick : ()=>{onTabSelected([BasketPricesTab, context.basket_prices])}, widget_id : constants.widget_ids.button}]}/>
                <CurrComponent context = {currContext}/>
           </div>)
}


export default PricesPage
