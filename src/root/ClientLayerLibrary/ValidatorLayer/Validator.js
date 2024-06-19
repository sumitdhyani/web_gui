function validateRequest(request){
    const action = request.action
    const type = request.type
    if(undefined === action) {
        throw {message : `The tag 'action' is missing from the request`}
    } else if( undefined === type) {
        throw {message : `The tag 'type' is missing from the request`}\
    }
    
    if(0 == action.localeCompare("subscribe") ||
       0 == action.localeCompare("unsubscribe")){
        if(undefined == request.exchange || undefined == request.symbol){
            throw {message : `Please provide both 'exchange' and 'symbol' tags`}
        }
    } else {
        throw {message : `Improper value ${action} for tag 'action' valid valiues are 'subscribe' and 'unsubscribe'`}
    }

    if( !(0 == type.localeCompare("depth") ||
          0 == type.localeCompare("trade"))) {
        throw {message : `Improper value ${type} for tag 'type' valid valiues are 'depth' and 'trade'`}
    } 
}

module.exports.validateRequest = validateRequest