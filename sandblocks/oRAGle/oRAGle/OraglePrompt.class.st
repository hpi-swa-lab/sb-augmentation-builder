Class {
	#name : #OraglePrompt,
	#superclass : #Object,
	#instVars : [
		'modules',
		'input',
		'defaultNumberOfOutputs',
		'replies',
		'approvedPrice'
	],
	#category : #oRAGle
}

{
	#category : #'instance creation',
	#'squeak_changestamp' : 'ct 1/22/2024 16:09'
}
OraglePrompt class >> with: aModule [
 
	^ self new
		add: aModule;
		yourself
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/22/2024 16:13'
}
OraglePrompt >> add: aModule [

	modules add: aModule.
	input := input , aModule content.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/22/2024 16:12'
}
OraglePrompt >> add: aPrompt separator: aString [

	modules addAll: aPrompt modules.
	input := input , aString , aPrompt input.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/26/2024 22:07'
}
OraglePrompt >> approvedPrice [

	^ approvedPrice
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/26/2024 22:07'
}
OraglePrompt >> approvedPrice: cents [

	approvedPrice := cents.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 19:44'
}
OraglePrompt >> assureOutputs [

	self assureReplies.
	^ self outputs
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/16/2024 19:45'
}
OraglePrompt >> assureReplies [

	^ self assureReplies: self defaultNumberOfOutputs
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/16/2024 19:57'
}
OraglePrompt >> assureReplies: number [

	replies ifNil: [replies := self generateReplies: number].
	replies size < number ifTrue:
		[replies := replies , (self generateReplies: number - replies size)].
	replies size > number ifTrue:
		[replies := replies take: number].
	^ replies
]

{
	#category : #copying,
	#'squeak_changestamp' : 'ct 1/22/2024 16:08'
}
OraglePrompt >> copyWith: aModule separator: aString [

	^ self copy
		add: aModule separator: aString;
		yourself
]

{
	#category : #defaults,
	#'squeak_changestamp' : 'ct 1/22/2024 16:50'
}
OraglePrompt >> defaultMaxNumberOfTokens [

	^ 100
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 19:12'
}
OraglePrompt >> defaultNumberOfOutputs [

	^ defaultNumberOfOutputs
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/16/2024 19:13'
}
OraglePrompt >> defaultNumberOfOutputs: anInteger [

	defaultNumberOfOutputs := anInteger.
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/16/2024 19:47'
}
OraglePrompt >> generateReplies: number [

	approvedPrice ifNotNil:
		[| price |
		(price := (self priceToGenerateOutputs: number) maxCents) > "approvedPrice"10 ifTrue:
			[self notify: ('about to spend {1}' format: {price})].
		approvedPrice := 0].
	^ self newConversation getAssistantMessages: number
]

{
	#category : #'initialize-release',
	#'squeak_changestamp' : 'ct 1/26/2024 21:59'
}
OraglePrompt >> initialize [

	super initialize.
	
	modules := OrderedCollection new.
	input := String new.
	approvedPrice := 0.
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/22/2024 16:11'
}
OraglePrompt >> input [

	^ input
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 2/3/2024 23:36'
}
OraglePrompt >> metricsForModule: aModule [

	^ OragleMetricsVisitor new
		conversation: self newConversation;
		rootModule: aModule;
		value
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/22/2024 16:11'
}
OraglePrompt >> modules [

	^ modules
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/3/2024 21:25'
}
OraglePrompt >> newConversation [

	^ SemanticConversation new
		addUserMessage: input;
		withConfigDo: [:config |
			config maxTokens: self defaultMaxNumberOfTokens];
		yourself
]

{
	#category : #accessing,
	#'squeak_changestamp' : 'ct 1/22/2024 16:38'
}
OraglePrompt >> outputs [

	^ (replies ifNil: [^ nil]) collect: #content
]

{
	#category : #copying,
	#'squeak_changestamp' : 'ct 1/22/2024 16:02'
}
OraglePrompt >> postCopy [

	super postCopy.
	
	modules := modules copy.
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/16/2024 19:47'
}
OraglePrompt >> priceToGenerateOutputs [

	^ self priceToGenerateOutputs: self defaultNumberOfOutputs
]

{
	#category : #private,
	#'squeak_changestamp' : 'ct 2/16/2024 19:41'
}
OraglePrompt >> priceToGenerateOutputs: number [

	^ self newConversation
		estimatePriceToGetAssistantMessages: number
]

{
	#category : #comparing,
	#'squeak_changestamp' : 'ct 2/3/2024 18:15'
}
OraglePrompt >> promptKey [

	^ self input
]
