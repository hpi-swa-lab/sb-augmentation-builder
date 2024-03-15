Extension { #name : #WebServer }

{
	#category : #'*Oragle-handling-override',
	#'squeak_changestamp' : 'ct 2/16/2024 18:19'
}
WebServer >> dispatchRequest: request url: dispatchUrl [
	"Look up the handler for a given url and dispatch to it"

	| entryUrl action |
	"Handle TRACE requests right away"
	request method = 'TRACE' ifTrue:[
		^request send200Response: request asString contentType: 'message/http'.
	].

	"Look up the entry point for the request"
	action := nil.
	entryUrl := dispatchUrl asLowercase.
	(entryUrl beginsWith: '/') ifFalse:[entryUrl := '/', entryUrl].
	mutex critical:[
		[entryUrl notEmpty and:[action == nil]] whileTrue: [
			action := entryPoints at: entryUrl ifAbsent:[nil].
			entryUrl := entryUrl copyUpToLast: $/.
		].
		action ifNil:[action := entryPoints at: '/' ifAbsent:[nil]].
	].

	"Handle OPTIONS requests"
	(request method = 'OPTIONS'
		and: [
		self flag: #moveUpstream. "<-- Oragle (WebClient-Core-ct.136, inbox)"
		((action at: 1) includes: request method) not] "action handles the request manually, (e.g.., to provide CORS headers)") ifTrue:[
		"HEAD, TRACE, and OPTIONS are always supported"
		request sendOptionsResponse: self builtinHttpMethods,
			(action ifNil:[self defaultHttpMethods] ifNotNil:[action first])
	].

	"Handle 404 not found"
	action ifNil:[^request send404Response].

	"Handle 405 method not allowed"
	(request method = 'HEAD' "builtin" 
		or:[(action at: 1) includes: request method]) ifFalse:[
			^request send405Response: self builtinHttpMethods, action first.
		].

	^[self invokeAction: (action at: 2) request: request] 
		on: Error do:[:ex|
			errorHandler 
				ifNil:[self handleError: ex request: request]
				ifNotNil:[errorHandler value: ex value: request]
		].

]

{
	#category : #'*Oragle-errors',
	#'squeak_changestamp' : 'ct 2/16/2024 18:18'
}
WebServer >> oragleHandleError: ex request: aRequest do: responseBlock [
	"The default error handling during processing. Sends a 500 response."

	| errLabel errReport errLog |
	errLabel := [ex description] on: Error do:[:ex2| 
		ex2 return: ex class name
	].
	errReport := [self errorReportFor: ex] on: Error do:[:ex2|
		ex2 return: '<error report failed>'.
	].
	[self log: errLabel] on: Error do:[:ex2| ex return].
	[self log: String cr, errReport] on: Error do:[:ex2| ex return].
	
	errLog := '<html><head><title>500 Internal Server Error</title></head><body>',
		'<h1>Internal Server Error</h1><pre>',
		(errReport  copyReplaceAll: String cr with: String crlf),
		'</pre></body></html>'.
	aRequest
		sendResponseCode: 500
		content: errLog squeakToUtf8
		type: 'text/html, charset=utf-8'
		do: [:response |
			responseBlock value: response.
			response headerAt: 'Connection' put: 'close'].
]
