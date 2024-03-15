Class {
	#name : #OragleMetricsVisitor,
	#superclass : #OragleVisitor,
	#instVars : [
		'conversation'
	],
	#category : #oRAGle
}

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/3/2024 23:35'
}
OragleMetricsVisitor >> conversation [

	^ conversation
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/4/2024 00:12'
}
OragleMetricsVisitor >> conversation: aSemanticConversation [

	conversation := aSemanticConversation.
]

{
	#category : #execute,
	#'squeak_changestamp' : 'ct 2/3/2024 23:36'
}
OragleMetricsVisitor >> value [

	^ rootModule accept: self
]

{
	#category : #visiting,
	#'squeak_changestamp' : 'ct 2/16/2024 18:41'
}
OragleMetricsVisitor >> visitAlternation: aModule [

	| childMetrics |
	childMetrics := aModule children collect: [:child |
		child accept: self].
	^ JsonObject new
		minTokens: (childMetrics ifEmpty: [Float nan] ifNotEmpty: [(childMetrics collect: #minTokens) min]);
		maxTokens: (childMetrics ifEmpty: [Float nan] ifNotEmpty: [(childMetrics collect: #maxTokens) max]);
		minPrice: (childMetrics ifEmpty: [OpenAIAmount oragleNan] ifNotEmpty: [(childMetrics collect: #minPrice) min]);
		maxPrice: (childMetrics ifEmpty: [OpenAIAmount oragleNan] ifNotEmpty: [(childMetrics collect: #maxPrice) max]);
		yourself
]

{
	#category : #visiting,
	#'squeak_changestamp' : 'ct 2/3/2024 23:41'
}
OragleMetricsVisitor >> visitLeafModule: aModule [

	| price tokens |
	tokens := conversation model countTokensIn: aModule content.
	price := conversation model priceForPrompt: aModule content.
	^ JsonObject new
		minTokens: tokens;
		maxTokens: tokens;
		minPrice: price;
		maxPrice: price;
		yourself
]

{
	#category : #visiting,
	#'squeak_changestamp' : 'ct 2/3/2024 23:43'
}
OragleMetricsVisitor >> visitSequenceModule: aModule [

	| childMetrics |
	childMetrics := aModule children collect: [:child |
		child accept: self].
	^ JsonObject new
		minTokens: (childMetrics ifEmpty: [0] ifNotEmpty: [(childMetrics collect: #minTokens) sum]);
		maxTokens: (childMetrics ifEmpty: [0] ifNotEmpty: [(childMetrics collect: #maxTokens) sum]);
		minPrice: (childMetrics ifEmpty: [OpenAIAmount zero] ifNotEmpty: [(childMetrics collect: #minPrice) sum]);
		maxPrice: (childMetrics ifEmpty: [OpenAIAmount zero] ifNotEmpty: [(childMetrics collect: #maxPrice) sum]);
		yourself
]
