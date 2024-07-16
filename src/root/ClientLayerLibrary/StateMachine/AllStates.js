const FSM = require('../../AsyncFSM')
const State = FSM.State
const SpecialTransition = FSM.SpecialTransition

class Authenticating extends State{
    constructor(params){
        super()
        this.construction_params = params 
        this.auth_params = params.auth_params
        this.authentication_method = params.authentication_method
        this.feed_server_conn_method = params.feed_server_conn_method
        this.connection_layer_termination_method = params.connection_layer_termination_method
        this.intent_handler = params.intent_handler
        this.logger = params.logger
    }

    onEntry(){
        this.authentication_method(this.auth_params)
    }

    on_disconnect(reason){
        this.logger.warn(`Disconnection evt received in Authenticating state, reason: ${reason}`)
    }

    on_auth_response(response){
        if(response.success){
            return new ConnectingToFeedServer({feed_server_conn_method: this.feed_server_conn_method, 
                                           conn_params: response.conn_params,
                                           intent_handler : this.intent_handler,
                                           authentication_params : this.construction_params,
                                           logger : this.logger})
        }
        else{
            return new Exiting({reason : response.reason,
                            connection_layer_termination_method : this.connection_layer_termination_method,
                            logger : this.logger})
        }
    }

    on_client_intent(intent){
        return SpecialTransition.deferralTransition
    }
}

class ConnectingToFeedServer extends State{
    constructor(params){
        super()
        this.feed_server_conn_method = params.feed_server_conn_method
        this.conn_params = params.conn_params
        this.intent_handler = params.intent_handler
        this.authentication_params = params.authentication_params
        this.logger = params.logger
    }

    on_launch(){
        try{
            this.feed_server_conn_method(this.conn_params, this.logger)
            return new Operational({intent_handler : this.intent_handler,
                authentication_params : this.authentication_params,
                logger: this.logger})
        }
        catch(err){
            this.logger.warn(err.message)
            return new Authenticating(this.authentication_params)
        }

    }

    on_disconnect(err) {
        this.logger.warn(err.message)
        return new Authenticating(this.authentication_params)
    }

    on_client_intent(intent) {
            return SpecialTransition.deferralTransition
    }
}

class Exiting extends State{
    constructor(params){
        super(true)
        this.reason = params.reason
        this.connection_layer_termination_method = params.connection_layer_termination_method
        this.logger = params.logger
    }

    onEntry(){
        this.logger.info(`Exiting the library layer, reason: ${this.reason}`)
        this.connection_layer_termination_method()
    }
}

class Operational extends State{
    constructor(params){
        super()
        this.intent_handler = params.intent_handler
        this.authentication_params = params.authentication_params
        this.logger = params.logger
    }

    on_client_intent(intent){
        this.intent_handler(intent)
    }

    on_disconnect(reason){
        this.logger.warn(`Disconnection evt received, reason: ${reason}`)
        return new Authenticating(this.authentication_params)
    }

    on_auth_response(response){
    }
}

module.exports.Authenticating = Authenticating
