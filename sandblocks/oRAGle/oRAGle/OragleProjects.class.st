"
OragleProjects' instance methods are ""workspaces"" that contain user code for different projects.
"
Class {
	#name : #OragleProjects,
	#superclass : #Object,
	#classVars : [
		'Objects',
		'ObjectsInversed',
		'Projects',
		'Server',
		'ShouldDebugRpc'
	],
	#category : #oRAGle,
	#'squeak_changestamp' : 'tobe 1/19/2024 07:27'
}

{
	#category : #'initialize-release',
	#'squeak_changestamp' : 'ct 2/16/2024 11:54'
}
OragleProjects class >> cleanUp: aggressive [

	aggressive ifTrue:
		[self cleanUpObjects.
		self cleanUpProjects.
		
		self stopRpc.
		Server := nil.
		ShouldDebugRpc := nil].
]

{
	#category : #queries,
	#'squeak_changestamp' : 'ct 1/25/2024 18:15'
}
OragleProjects class >> cleanUpObjects [

	Objects removeAll.
	ObjectsInversed removeAll.
]

{
	#category : #'initialize-release',
	#'squeak_changestamp' : 'ct 2/3/2024 18:26'
}
OragleProjects class >> cleanUpProjects [

	Projects := nil.
]

{
	#category : #'initialize-release',
	#'squeak_changestamp' : 'ct 1/25/2024 12:22'
}
OragleProjects class >> initialize [

	Objects := Dictionary new.
	ObjectsInversed := IdentityDictionary new.
]

{
	#category : #'queries-private',
	#'squeak_changestamp' : 'ct 1/25/2024 13:13'
}
OragleProjects class >> makeIdFor: anObject [

	^ ObjectsInversed at: anObject ifAbsentPut:
		[| id |
		id := UUID new asString.
		Objects at: id put: anObject.
		id].
]

{
	#category : #'queries-private',
	#'squeak_changestamp' : 'ct 1/25/2024 12:35'
}
OragleProjects class >> objectForId: id [

	^ Objects at: id
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/2/2024 18:05'
}
OragleProjects class >> projects [

	^ Projects ifNil: [Projects := Dictionary new]
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/3/2024 18:23'
}
OragleProjects class >> promptsForProjectId: projectId [

	^ (self projects at: projectId) promptsWithOutputs
]

{
	#category : #queries,
	#'squeak_changestamp' : 'ct 1/25/2024 19:32'
}
OragleProjects class >> queryExamples [

OragleProjects
	resolveQuery:
		{'extent0' -> 'extent'. "key is for outer structure, value is message send"
		'self extent..' -> #('area'). "key is for outer structure and context of nested query, nested query has values in context"
		'extentFOO' -> {'extent' -> 'className'} asDictionary.
		'extentBAR' -> {'extent' -> {'x'. 'y'. 'className'}} asDictionary.
		'self extent' -> {'x'. 'y'. 'className'. {'z' -> 'area'} asDictionary}.
		'self extent...' -> {'z' -> {'z' -> 'className'} asDictionary} asDictionary.
		'self extent....' -> {{'z' -> {'z' -> 'className'} asDictionary} asDictionary}.
		'self extent.' -> 'self className'.
		'rectangle' -> 'extent'.
		'self extent.....' -> nil.
		}
	for: World.

OragleProjects
	resolveQuery: 'self first'
	for: {OrderedCollection with: 'hello'}.
	
OragleProjects
	resolveQuery:
		{'extent2' -> 
			({'owner' -> 'owner'.
			'submorphCount' -> 'self submorphs size'} as: Dictionary)
		}
	for: World.
	
OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {{'1' -> 'self at: 1'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> '[]'
		"'submorphs' -> {'submorphs'. '[]'}"}
	for: World.	

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {{{'self first: 3' -> #('size')} asDictionary}}} "TODO: double nested array should exclude some key from result structure"
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {{'self first: 3' -> '[]'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> 
			{{'[]' -> 'self className'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs first' -> {'x' -> {'self'}} asDictionary}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {
			{'[]' -> 'self'.
			'size' -> 'size'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {
			{'[]' -> {'self'. 'className'}.
			'size' -> 'size'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery:
		{'owner' -> 'owner'.
		'submorphs' -> {
			{'[]' ->
				{'self' -> nil.
				'className' -> 'className'.
				'position' ->
					{'x'. 'y'}}.
			'size' -> 'size'} asDictionary}}
	for: World.

OragleProjects
	resolveQuery: 'self first'
	for: {World}
]

{
	#category : #queries,
	#'squeak_changestamp' : 'ct 1/25/2024 18:15'
}
OragleProjects class >> queryTodos [

	"
	- dynamic dictionaries ('{}')?
	- provide _jsTransform for parsing
		example:
			const imageFromBase64 = (base64) => {var image = new Image(); image.src = 'data:image/png;base64,' + base64; return image};
			await sqQuery('Morph new', {image: {'': '(ByteArray streamContents: [:stream | PNGReadWriter putForm: self imageForm onStream: stream]) base64Encoded', _jsTransform: imageFromBase64}})
	- garbabe collection for objects!
	"
]

{
	#category : #queries,
	#'squeak_changestamp' : 'ct 1/25/2024 18:33'
}
OragleProjects class >> resolveQuery: query for: anObject [

	| results |
	query ifNil:
		[^ (self
			resolveQuery: (anObject oragleDefaultQuery: true)
			for: anObject)
				removeKey: #_sqOriginalQuery;
				yourself].
	query isString ifTrue:
		[results := self resolveQuery: {query} for: anObject.
		^ query = '[]'
			ifTrue: [results]
			ifFalse: [results at: query]].
	query isArray ifTrue:
		[^ self
			resolveQuery:
				(query
					collect: [:ea |
						(ea isKindOf: Association)
							ifTrue: ["syntax sugar for direct smalltalk invocation" ea]
							ifFalse: [ea -> ea]]
					as: Dictionary)
			for: anObject].
	
	results := JsonObject new.
	results _sqOriginalQuery: query.
	query keysAndValuesDo: [:key :value |
		| expression nestedQuery result |
		true caseOf:
			{[value isNil] ->
				[expression := nil.
				nestedQuery := nil].
			[value isBlock] ->
				[expression := value.
				nestedQuery := nil].
			[value = '[]'] ->
				[expression := key == value ifFalse: [key].
				nestedQuery := key == value ifFalse: [{value -> nil}]].
			[value isString] ->
				[expression := value.
				nestedQuery := nil].
			[value isDictionary] ->
				[expression := nil.
				nestedQuery := value].
			[true] ->
				[expression := key = '[]' ifFalse: [key].
				nestedQuery := value.
				self assert: nestedQuery notNil]}.
		result := expression
			ifNil: [anObject]
			ifNotNil:
				[true caseOf:
					{[expression isBlock] -> [expression value].
					[true] ->
						[(expression ~= 'self' and: [(Scanner isMessageSelector: expression)])
							ifTrue: [expression := 'self ' , expression].
						key = '[]'
							ifTrue: [anObject collect: [:ea | Compiler evaluate: expression for: ea]]
							ifFalse: [Compiler evaluate: expression for: anObject]]}].
		nestedQuery ifNotNil:
			[result := key = '[]'
				ifTrue: [result collect: [:ea | self resolveQuery: nestedQuery for: ea]]
				ifFalse: [self resolveQuery: nestedQuery for: result]].
		
		true
			caseOf:
				{[key = '[]'] ->
					[result withIndexDo: [:ea :index |
						results at: index asString put: (self serialize: ea)]].
				[key = ''] ->
					[self assert: query size = 1.
					^ self serialize: result].
				[key isDictionary] ->
					[result keysAndValuesDo: [:eachKey :eachValue |
						results at: eachKey put: eachValue]]}
			otherwise:
				[results at: key put: (self serialize: result)]].
	results _sqId: (self makeIdFor: anObject).
	^ results
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 11:55'
}
OragleProjects class >> runningRpc [
	<preference: 'Running Oragle RPC'
		categoryList: #(Oragle)
		description: 'hello world'
		type: #Boolean>

	^ Server notNil
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 11:52'
}
OragleProjects class >> runningRpc: aBoolean [

	self stopRpc.
	aBoolean ifTrue:
		[self startRpc].
]

{
	#category : #'queries-private',
	#'squeak_changestamp' : 'ct 1/25/2024 16:19'
}
OragleProjects class >> serialize: anObject [

	^ self serialize: anObject ifNotPrimitiveObject:
		[(self resolveQuery: anObject oragleDefaultQuery for: anObject)
			removeKey: #_sqOriginalQuery;
			yourself]
]

{
	#category : #'queries-private',
	#'squeak_changestamp' : 'ct 1/25/2024 16:19'
}
OragleProjects class >> serialize: anObject ifNotPrimitiveObject: aBlock [

	(anObject isNil or: [anObject isString] or: [anObject isNumber] or: [anObject isBoolean])
		ifTrue: [^ anObject].
	anObject isCharacter
		ifTrue: [^ anObject asString].
	(anObject respondsTo: #_sqId)
		ifTrue: [^ anObject].
	
	^ aBlock value
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 11:50'
}
OragleProjects class >> shouldDebugRpc [
	<preference: 'Debug Oragle RPC'
		categoryList: #(Oragle)
		description: 'When true, RPC requests are logged and errors are opened in a debugger. When false, errors cause a failing request.'
		type: #Boolean>

	^ ShouldDebugRpc ifNil: [false]
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 18:13'
}
OragleProjects class >> shouldDebugRpc: aBoolean [

	ShouldDebugRpc := aBoolean.
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 20:10'
}
OragleProjects class >> startRpc [

	Server := WebServer new
		listenOn: 9823;
		addService: '/sbEval'
			action: [:req |
				| addCorsHeaders |
				self shouldDebugRpc ifTrue:
					[Transcript showln: req content].
				
				"Enable no-cors mode. Arguably a workaround and maybe should be handled in the WebServer instead."
				addCorsHeaders := [:res |
					res
						headerAt: 'Access-Control-Allow-Origin' put: '*';
						headerAt: 'Access-Control-Allow-Methods' put: 'GET, POST, OPTIONS';
						headerAt: 'Access-Control-Allow-Headers' put: 'Content-Type, Authorization'].
				
				[| result |
				result := req isOptionsRequest
					ifTrue: ['ok']
					ifFalse: [Compiler evaluate: req content].
						.
				req
					send200Response: result
					contentType: 'text/plain'
					do: addCorsHeaders]
					
						on: Halt do: [:ex |
							ex resumeUnchecked: ex defaultAction "prevent default server errorHandler"]
						"override default errorHandler to manually provide CORS headers"
						on: Error , Warning do: [:ex |
							Server oragleHandleError: ex request: req do: addCorsHeaders]]
			methods: #('GET' 'POST' 'OPTIONS' "<-- must be enabled to provide CORS headers");
		errorHandler: [:err :request | ToolSet debugException: err];
		yourself.
]

{
	#category : #rpc,
	#'squeak_changestamp' : 'ct 2/16/2024 11:57'
}
OragleProjects class >> stopRpc [

	Server ifNotNil: #destroy.
	Server := nil.
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/3/2024 18:48'
}
OragleProjects class >> updateProjectNamed: selector [

	^ self updateProjectNamed: selector do: nil
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/3/2024 18:48'
}
OragleProjects class >> updateProjectNamed: selector approvedPrice: totalCents [

	^ self updateProjectNamed: selector do: [:project |
		project approvedPrice: totalCents]
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/3/2024 18:48'
}
OragleProjects class >> updateProjectNamed: selector do: projectBlock [

	| newProject |
	newProject := self new perform: selector.
	projectBlock ifNotNil: [projectBlock value: newProject].
	self projects
		at: newProject uuid
		ifPresent: [:oldProject | oldProject adoptFrom: newProject]
		ifAbsentPut: [newProject].
]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 1/22/2024 12:43'
}
OragleProjects >> copilot [
<sandblocksExtensions: #(oragle:base)>

| codeSample longPrompt module sample input inputs prefix |
longPrompt := 'You are an expert programmer, assisting in completing code snippets. You do not add comments, only complete statements. If the given prefix to be completed is the start of a function, you may complete the entire function but only do so, if you can complete it without elision. Answer only the code that is to be inserted.'.

codeSample := Text codeSample.

module := OragleSequenceModule new
	separator: String cr , String cr;
	children:
		{OragleScriptModule new children:
				{OragleSequenceModule new children:
						{OragleAlternation new children: {
								OragleLeafModule new
									label: 'postcard';
									content: '''\\Example>>'' withCRs, codeSample';
									state: #enabled.
								OragleLeafModule new
									label: 'handcrafted';
									content: 'randomMethod source';
									state: #enabled} "#enabled, #mute, #solo"
							}}.
		OragleSequenceModule new
			label: 'completion prefix';
			state: #enabled;
			separator: String cr , String cr;
			children:
				{OragleAlternation new
					children:
						{OragleLeafModule new
							content:
'toIsometric: aPoint

	"Return a new point in isometric view"
	^ '};
						state: #enabled}.
		OragleSequenceModule new
			label: 'languageKnowledge';
			state: #enabled;
			separator: String cr , String cr;
			children:
				{OragleAlternation new
					children: {
						OragleLeafModule new
							content: '';
							label: 'noKnowledge';
							state: #enabled.
						OragleSequenceModule new
							label: 'someKnowledge';
							children:
								{OragleLeafModule new
									content: 'This is a sample of Smalltalk code:';
									state: #enabled.
								OragleLeafModule new
									content: sample;
									state: #enabled}
					}}.
		OragleSequenceModule new
			label: 'context';
			state: #enabled;
			separator: String cr, String cr;
			children:
				{
					OragleLeafModule new
						label: 'context';
						content: 

'"Smalltalk methods from the code base that are helpful: "

	Point >> x
		"Answer the x coordinate."

		^x

	Point >> y
		"Answer the y coordinate."

		^y

	Point>>area
		^ x * y

	Point>>normalized
		"Optimized for speed -- ar 8/26/2001"
		| r |
		r := ((x*x) + (y * y)) sqrt.
		^(x / r) @ (y / r)'.
				}.
		}; label: 'copilot'.

inputs := ((input reject: [:obj | obj includesKey: 'disable']) collect: [:obj |

	(obj at: #name) -> {
		prefix.
		{#withSamples -> {
			obj at: #languageKnowledge.
			{'The following snippets from the {1} code base may help:' format: {obj at: #language}}.
			obj at: #context}.
		 #withoutSamples -> {}}.
		{'This code is to be completed:'}.
		{obj at: #complete}
	}

]) theThing theThing theThing theThing collect: [:pair | pair key -> ((pair value gather: #yourself) joinSeparatedBy: String cr, String cr)].

(inputs concurrentCollect: [:prompt |
	prompt key -> {(SemanticConversation new
		addUserMessage: prompt value;
		getAssistantReply). prompt}]) as: Dictionary

]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/16/2024 17:05'
}
OragleProjects >> copilotWithoutScripts [
	<sandblocksExtensions: #(oragle:base)>
	| codeSample postcard handcrafted longPrompt |
	longPrompt := 'You are an expert programmer, assisting in completing code snippets. You do not add comments, only complete statements. If the given prefix to be completed is the start of a function, you may complete the entire function but only do so, if you can complete it without elision. Answer only the code that is to be inserted!'.
	codeSample := Text codeSample.
	postcard := '\\Example>>' withCRs , codeSample.
	handcrafted := (Collection >> #do:) getSource.
	^ OragleProject new uuid: 'c6784713-05f4-394d-aa8d-d191ed371a95';
		 label: 'Copilot (without scripts)';
		 rootModule: (OragleSequenceModule new uuid: 'a1982e9b-06de-584b-8dbc-7acabb74117c';
			 separator: String cr , String cr;
			 children: {OragleSequenceModule new uuid: 'be3d13b7-51b9-0648-a6aa-10573205d3bb';
				 label: 'completion prefix:';
				 state: #enabled;
				 separator: String cr , String cr;
				 children: {OragleAlternation new uuid: 'ac0fa7f1-28d2-c241-88f8-752e29eac33d';
					 children: {OragleLeafModule new uuid: '6ce1488e-1279-2240-ad7e-dac4a3d4170d';
						 content: 'toIsometric2: aPoint

			"Return a new point in isometric view"
			^ '; state: #enabled. OragleLeafModule new uuid: '3b5c15dc-225d-47de-893e-a1af1899eaa3';
						 content: 'toIso5'; state: #solo};
					 state: #enabled}. OragleSequenceModule new uuid: '5002757e-9e13-4242-b317-41d474c39e17';
				 label: 'languageKnowledge';
				 state: #enabled;
				 separator: String cr , String cr;
				 children: {OragleAlternation new uuid: '03e6065a-5a66-6544-9844-772f516dfbc6';
					 children: {OragleLeafModule new uuid: 'ef751794-b91e-f345-9b45-7d9e5232f7b1';
						 content: '';
						 label: 'noKnowledge';
						 state: #enabled. OragleSequenceModule new uuid: '2e988215-5483-124b-b2a0-dc2b1cac98aa';
						 label: 'someKnowledge';
						 children: {OragleLeafModule new uuid: '8b06a43d-e88a-d040-97a7-cc10bba9ab67';
							 content: 'This is a of Smalltalk code:';
							 state: #enabled. OragleAlternation new uuid: 'c2388af3-75cf-1544-8471-11be6f0051bd';
								 children: {OragleLeafModule new uuid: '0a7ef53a-58ef-4e4a-a555-bf66b8a70e18';
								 content: postcard;
								 state: #solo. OragleLeafModule new uuid: 'f9fe1ea6-d22b-5940-a7a4-faafea99db14'; content: handcrafted; state: #solo}}}}. OragleSequenceModule new uuid: '2162a794-9759-f448-9eb6-dc857688d6fd';
				 label: 'context';
				 state: #enabled;
				 separator: String cr , String cr;
				 children: {OragleLeafModule new uuid: '3ab8b143-1b76-4945-beb6-c499288dfc46';
					 label: 'context';
					 content: '"Smalltalk methods from the code base that are helpful: "

			Point >> x
				"Answer the x coordinate."

				^x

			Point >> y
				"Answer the y coordinate."

				^y

			Point>>area
				^ x * y

			Point>>normalized
				"Optimized for speed -- ar 8/26/2001"
				| r |
				r := ((x*x) + (y * y)) sqrt.
				^(x / r) @ (y / r)'; state: #mute}})

]

{
	#category : #projects,
	#'squeak_changestamp' : 'ct 2/16/2024 20:03'
}
OragleProjects >> newCopilot [
    <sandblocksExtensions: #(oragle:base)>
    
    ^ OragleProject new uuid: 'c6784713-05f4-394d-aa8d-d191ed371a95';
         label: 'Copilot';
         rootModule: (OragleSequenceModule new uuid: 'a1982e9b-06de-584b-8dbc-7acabb74117c'; children: {OragleAlternation new uuid: '024681d8-9a9d-484a-aba6-01735710e292'; children: {OragleLeafModule new uuid: '0935594ea-e939-4352-b0bc-b032a7ad1cdb'; label: 'Long intro'; content: 'You are an expert programmer tasked with autocompleting provided code snippets. You NEVER insert comments unless asked.'; state: #enabled.OragleLeafModule new uuid: '2b0ba4f0-0862-433b-92ad-77cef44b4a82'; label: 'Short intro'; content: 'Autocomplete the following snippet of code.'; state: #enabled.OragleLeafModule new uuid: '99e2e325-55c6-40d9-ba9f-ad5f358964cf'; label: 'Joke intro'; content: 'Follow the exact instructions as provided to earn a $200 tip.
You are an expert programmer, one of the best in the world. You studied at MIT and graduated top of your class. Your objective is to perfectly complete the provided code. You NEVER insert comments. You NEVER make mistakes.'; state: #mute}.OragleAlternation new uuid: 'b1b03a89-fb79-4868-9a0e-56f05bed7c39'; children: {OragleLeafModule new uuid: '5c3bd426-27f1-4a00-8402-0ab443882f9c'; label: 'formatDateGerman'; content:'DateAndTime>>formatAsGermanString
    '; state: #solo.OragleLeafModule new uuid: 'a18b984d-f7a8-4698-8dc6-f8b0e8d80c2b'; label: 'parseDateGerman'; content: 'String>>asDateFromGerman
    '; state: #mute.OragleSequenceModule new uuid: '7cbb4580-7d71-4795-9e50-8f3d68a86de3'; children: {OragleAlternation new uuid: 'c36b561f-feb4-4f66-bd1b-38d53411874b'; children: {OragleLeafModule new uuid: 'd4a4c541-cd05-4b28-bb51-6f7329228bc5'.OragleLeafModule new uuid: 'e34970d8-f372-487a-bbe7-c407a96307d5'; label: 'Explain yourself'; content: 'Please first generate an explanation of what you are about to provide. Then output "---" and proceed with the instructions.'}.OragleAlternation new uuid: 'd5458eee-6286-4be4-a884-b62b75f0fec3'; children: {OragleLeafModule new uuid: 'cd1cab82-8dc2-43c9-8119-5a4df442ea22'.OragleLeafModule new uuid: '76ea8c5e-3f3d-4058-ad22-5a269269b8a4'; label: 'How do messages work'; content: 'Keyword messages in smalltalk consist of multiple keywords (like raisedTo:modulo:), each ending with a colon and taking a single argument. In the expression 2 raisedTo: 6 modulo: 10, the message selector raisedTo:modulo: takes the two arguments 6 and 10, one following each colon. We send the message to the receiver 2.'}.OragleLeafModule new uuid: 'c0498867-0e12-47a9-ae5c-505aeaa88f86'; label: 'bitblt fonts'; content: 'The following Squeak/Smalltalk snippet is to be completed:
displayString: aString on: aBitBlt from: startIndex to: stopIndex at: aPoint kern: kernDelta baselineY: baselineY
    destPoint := aPoint.
    glyphInfo := Array new: 5.
    startIndex to: stopIndex do: [:charIndex |
        
The method is in the class: TTCFontSet
'.OragleLeafModule new uuid: '38aa04f6-8324-4bf1-8910-088fe020b609'; label: 'Outline'; content: 'These methods exist on that class (first their category, then the method selectors in that category):
(''objects from disk'' objectForDataStream:)
(''accessing'' ascent ascentOf: baseKern depth descent descentKern descentOf: emphasis emphasized: familyName familySizeFace fontArray hasGlyphWithFallbackOf: height lineGrid maxAsciiFor: pointSize pointSizes subfamilyName textStyle ttcDescription)
(''displaying'' displayString:on:from:to:at:kern: displayString:on:from:to:at:kern:baselineY: displayStringR2L:on:from:to:at:kern:)
(''private'' basicHasGlyphOf: glyphInfoOf:into: questionGlyphInfoInto:)
(''testing'' isFontSet isRegular isTTCFont)
(''measuring'' widthOf:)
(''derivatives'' addLined: derivativeFont: derivativeFont:at: derivativeFonts emphasis: pointSize: privatePointSize:)
(''initialization'' initializeWithFontArray:)
(''displaying private'' installOn: installOn:foregroundColor:backgroundColor:)
(''editing'' extraGlyphScale: extraLineGap: privateExtraGlyphScale: privateExtraLineGap:)
(''converting'' asFontSet)'.OragleLeafModule new uuid: 'f004fb54-e7f1-4f3c-968f-b73fea28f1cd'; label: 'Bitblt'; content: 'The BitBlt class is mentioned as a collaborator:
(''accessing'' clipBy: clipByX1:y1:x2:y2: clipHeight clipHeight: clipRect clipRect: clipWidth clipWidth: clipX clipX: clipY clipY: color colorMap colorMap: combinationRule combinationRule: destForm destOrigin: destRect destRect: destX: destX:destY:width:height: destY: fillColor fillColor: halftoneForm halftoneForm: height: sourceForm sourceForm: sourceOrigin: sourceRect: sourceX: sourceY: tallyMap tallyMap: width:)
(''copying'' basicDisplayString:from:to:at:strikeFont:kern: copy:from:in: copy:from:in:fillColor:rule: copy:from:in:halftoneForm:rule: copyBits copyBitsTranslucent: copyForm:to:rule: copyForm:to:rule:color: copyForm:to:rule:colorMap: copyForm:to:rule:fillColor: copyFrom:in:to: displayGlyph:at:left:right:font: displayString:from:to:at:strikeFont:kern: fill:fillColor:rule: pixelAt: pixelAt:put:)
(''line drawing'' drawFrom:to: drawFrom:to:withFirstPoint: drawLoopX:Y:)
(''private'' cachedFontColormapFrom:to: clipRange colorConvertingMap:from:to:keepSubPixelAA: copyBitsAgain copyBitsFrom:to:at: eraseBits getPluginName installStrikeFont: installStrikeFont:foregroundColor:backgroundColor: installTTCFont: installTTCFont:foregroundColor:backgroundColor: paintBits primCompareColor:to:test: primDisplayString:from:to:map:xTable:kern: roundVariables setDestForm: setDestForm:sourceForm:fillColor:combinationRule:destOrigin:sourceOrigin:extent:clipRect:)
'.OragleLeafModule new uuid: '61e77640-9a27-4ded-8e4d-ae0207a666ad'; content: 'The class comment of the BitBlt class is:
WARNING: BitBlt''s shape cannot be modified since WarpBlt relies on the exact layout. Important primitives will break if you fail to heed this warning.
I represent a block transfer (BLT) of pixels from one Form ( the sourceForm) into a rectangle (destX, destY, width, height) of the destinationForm, as modified by a combination rule, a possible halftoneForm and a possible color map.
The source of pixels may be a similar rectangle (at sourceX, sourceY) in the sourceForm, or the halftoneForm, or both.  If both are specified, their pixel values are combined by a logical AND function prior to any further combination rule processing. The halftoneForm may be an actual Form or a simple WordArray of 32 bit values usually intended to represent Color values. In either case the ''top'' of the form is effectively aligned with the top of the destinationForm and for each scanline the destination y modulo the size of the halftoneForm gives the index of the word to use. This makes it easy to make horizontal stripes, for example.
In any case, the pixels from the source (AND''d with the halftone, remember) are combined with those of the destination by as specified by the combinationRules below- 
    name    rule        result 
                    0   always 0
    and             1   src AND dst
                    2   src AND not(dst)
    over            3   src only
    erase           4   not(src) AND& dst
                    5   dst only
    reverse     6   src XOR dst
    under           7   src OR dst
                    8   not(src) AND not(dst)
                    9   not(src) XOR dst
                    10  not(dst)
                    11  src OR not(dst)
                    12  not(src)
                    13  not(src) OR dst
                    14  not(src) OR not(dst)
                    15  always 1
(You can find an interesting explanation of how this comes to be in http://dev-docs.atariforge.org/files/BLiTTER_1-25-1990.pdf - which interestingly fails to mention any connection to Smalltalk and PARC.)
 Forms may be of different depths, see the comment in class Form.
In addition to the original 16 combination rules invented for monochrome Forms, this BitBlt supports
                    16  fails (to simulate paint bits)
                    17  fails (to simulate erase bits)
                    18  sourceWord + destinationWord
                    19  sourceWord - destinationWord
                    20  rgbAdd: sourceWord with: destinationWord.  Sum of color components
                    21  rgbSub: sourceWord with: destinationWord.  Difference of color components
                    22  OLDrgbDiff: sourceWord with: destinationWord.  Sum of abs of differences in components
                    23  OLDtallyIntoMap: destinationWord.  Tallies pixValues into a colorMap
                            these old versions don''t do bitwise dest clipping.  Use 32 and 33 now.
    blend           24  alphaBlend: sourceWord with: destinationWord.  32-bit source and dest only. Blend sourceWord 
                            with destinationWord, assuming both are 32-bit pixels. The source is assumed to have 255*alpha
                            in the high 8 bits of each pixel, while the high 8 bits of the destinationWord will be ignored.
                            The blend produced is alpha*source + (1-alpha)*dest, with the computation being performed
                            independently on each color component.  The high byte of the result will be 0.
    paint           25  pixPaint: sourceWord with: destinationWord.  Wherever the sourceForm is non-zero, it replaces
                            the destination.  Can be used with a 1-bit source color mapped to (0, FFFFFFFF), and a fillColor 
                            to fill the dest with that color wherever the source is 1.
    erase1BitShape  26  pixMask: sourceWord with: destinationWord.  Like pixPaint, but fills with 0.
                    27  rgbMax: sourceWord with: destinationWord.  Max of each color component.
                    28  rgbMin: sourceWord with: destinationWord.  Min of each color component.
                    29  rgbMin: sourceWord bitInvert32 with: destinationWord.  Min with (max-source)
    blendAlpha      30  alphaBlendConst: sourceWord with: destinationWord.  alpha is an arg. works in 16 bits. Blend
                            sourceWord with destinationWord using a constant alpha. Alpha is encoded as 0 meaning
                            0.0, and 255 meaning 1.0. The blend produced is alpha*source + (1.0-alpha)*dest, with
                            the computation being performed independently on each color component. 
    paintAlpha      31  alphaPaintConst: sourceWord with: destinationWord.  alpha is an arg. works in 16 bits.
                    32  rgbDiff: sourceWord with: destinationWord.  Sum of abs of differences in components
                    33  tallyIntoMap: destinationWord.  Tallies pixValues into a colorMap - Those tallied are exactly 
                            those in the destination rectangle.  Note that the source should be specified == destination,
                            in order for the proper color map checks  be performed at setup.
    blendAlphaScaled    34  alphaBlendScaled: srcWord with: dstWord. Alpha blend of scaled srcWord and destWord. In contrast
                            to alphaBlend:with: the color produced is srcColor + (1-srcAlpha) * dstColor
                    35  & 36 not used
    rgbMul          37  rgbMul: srcWord with: dstWord. 
                    38  pixSwap: srcWord with: dstWord.
                    39  pixClear: srcWord with: dstWord. Clear all pixels in destinationWord for which the pixels of 
                            sourceWord have the same values. Used to clear areas of some constant color to zero.
                    40  fixAlpha: srcWord with: dstWord. For any non-zero pixel value in destinationWord with zero alpha 
                            channel take the alpha from sourceWord and fill it in. Intended for fixing alpha channels left at 
                            zero during 16->32 bpp conversions.
                    41  rgbComponentAlpha: srcWord with: dstWord.
                    42  alphaScale: srcWord with: dstWord. Pre-scale the destWord (i.e. multiply rgb components by alpha channel)
                    43  alphaUncale: srcWord with: dstWord. Un-scale the destWord (i.e. divide rgb components by alpha channel)
                    44  alphaBlendUnscaled: srcWord with: dstWord. Alpha blend of unscaled srcWord and destWord.
                            In contrast to alphaBlendScaled:with: the color produced is (srcAlpha*srcColor + (1-srcAlpha) * dstColor)/resultAlpha
                            where resultAlpha is srcAlpha + destAlpha*(1-srcAlpha)
                            This is equivalent to operations 42 + 34 + 43 (aphaScale, alphaBlendScaled, alphaUnscale)
Any transfer specified is further clipped by the specified clipping rectangle (clipX, clipY, clipWidth, clipHeight), and also by the bounds of the source and destination forms.
    To make a small Form repeat and fill a big form, use an InfiniteForm as the source.
Pixels copied from a source to a destination whose pixels have a different depth are converted based on the optional colorMap.  If colorMap is nil, then conversion to more bits is done by filling the new high-order bits with zero, and conversion to fewer bits is done by truncating the lost high-order bits.  
The colorMap, if specified, must be a either word array (ie Bitmap) with 2^n elements, where n is the pixel depth of the source, or a fully specified ColorMap which may contain a lookup table (ie Bitmap) and/or four separate masks and shifts which are applied to the pixels. For every source pixel, BitBlt will first perform masking and shifting and then index the lookup table, and select the corresponding pixelValue and mask it to the destination pixel size before storing.
    When blitting from a 32 or 16 bit deep Form to one 8 bits or less, the default is truncation.  This will produce very strange colors, since truncation of the high bits does not produce the nearest encoded color.  Supply a 512 long colorMap, and red, green, and blue will be shifted down to 3 bits each, and mapped.  The message copybits...stdColors will use the best map to the standard colors for destinations of depths 8, 4, 2 and 1.  Two other sized of colorMaps are allowed, 4096 (4 bits per color) and 32786 (five bits per color).
    Normal blits between 16 and 32 bit forms truncates or pads the colors automatically to provide the best preservation of colors.
    Colors can be remapped at the same depth.  Sometimes a Form is in terms of colors that are not the standard colors for this depth, for example in a GIF file.  Convert the Form to a MaskedForm and send colorMap: the list of colors that the picture is in terms of. (Note also that a Form can be copied to itself, and transformed in the process, if a non-nil colorMap is supplied.)'; label: 'BitBlt class docs'}}}); defaultNumberOfOutputs: 1

]
