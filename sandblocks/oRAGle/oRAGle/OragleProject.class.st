Class {
	#name : #OragleProject,
	#superclass : #Object,
	#instVars : [
		'uuid',
		'label',
		'rootModule',
		'defaultNumberOfOutputs',
		'approvedPrice',
		'cachedPrompts'
	],
	#category : #oRAGle
}

{
	#category : #copying,
	#'squeak_changestamp' : 'ct 2/16/2024 19:30'
}
OragleProject >> adoptFrom: anotherProject [

	self assert: self uuid = anotherProject uuid.
	self label: anotherProject label.
	self rootModule: anotherProject rootModule.
	self defaultNumberOfOutputs: anotherProject defaultNumberOfOutputs.
	self approvedPrice: anotherProject approvedPrice.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/3/2024 18:19'
}
OragleProject >> approvedPrice [

	^ approvedPrice
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/3/2024 18:19'
}
OragleProject >> approvedPrice: cents [

	approvedPrice := cents.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 19:13'
}
OragleProject >> defaultNumberOfOutputs [

	^ defaultNumberOfOutputs
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 19:13'
}
OragleProject >> defaultNumberOfOutputs: anInteger [

	defaultNumberOfOutputs := anInteger.
]

{
	#category : #visiting,
	#'squeak_changestamp' : 'ct 2/16/2024 19:18'
}
OragleProject >> expand [

	^ self rootModule expand
		do: [:prompt | prompt defaultNumberOfOutputs: self defaultNumberOfOutputs];
		yourself
]

{
	#category : #'initialize-release',
	#'squeak_changestamp' : 'ct 2/16/2024 19:13'
}
OragleProject >> initialize [

	super initialize.
	
	defaultNumberOfOutputs := 1.
	cachedPrompts := Dictionary new.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/25/2024 20:10'
}
OragleProject >> label [

	^ label
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/25/2024 20:10'
}
OragleProject >> label: aString [

	label := aString.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 18:42'
}
OragleProject >> metricsForModule: aModule [

	| allMetrics |
	allMetrics := self expand collect: [:prompt |
		prompt metricsForModule: aModule].
	
	^ JsonObject new
		
		minTokens: (allMetrics ifEmpty: [Float nan] ifNotEmpty: [(allMetrics collect: #minTokens) min]);
		maxTokens: (allMetrics ifEmpty: [Float nan] ifNotEmpty: [(allMetrics collect: #maxTokens) max]);
		
		minPrice: (allMetrics ifEmpty: [OpenAIAmount oragleNan] ifNotEmpty: [(allMetrics collect: #minPrice) min]);
		maxPrice: (allMetrics ifEmpty: [OpenAIAmount oragleNan] ifNotEmpty: [(allMetrics collect: #maxPrice) max]);
		
		yourself
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/3/2024 21:05'
}
OragleProject >> moduleForId: id [

	^ self rootModule moduleForId: id
]

{
	#category : #visiting,
	#'squeak_changestamp' : 'ct 2/16/2024 19:52'
}
OragleProject >> promptsWithOutputs [

	| prompts |
	prompts := self expand.
	^ prompts collect: [:prompt |
		(cachedPrompts
			at: prompt promptKey
			ifAbsentPut:
				[approvedPrice ifNotNil:
					[prompt approvedPrice: approvedPrice.
					approvedPrice := approvedPrice - prompt priceToGenerateOutputs maxCents].
				prompt])
					defaultNumberOfOutputs: self defaultNumberOfOutputs;
					assureOutputs;
					yourself]
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/25/2024 20:10'
}
OragleProject >> rootModule [

	^ rootModule
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/25/2024 20:11'
}
OragleProject >> rootModule: aModule [

	rootModule := aModule.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/2/2024 17:01'
}
OragleProject >> uuid [

	^ uuid
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/2/2024 17:01'
}
OragleProject >> uuid: anObject [

	uuid := anObject.
]
