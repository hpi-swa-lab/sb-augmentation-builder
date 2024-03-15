Extension { #name : #Object }

{
	#category : #'*Oragle',
	#'squeak_changestamp' : 'ct 1/25/2024 18:56'
}
Object >> oragleDefaultQuery [

	^ self oragleDefaultQuery: false
]

{
	#category : #'*Oragle',
	#'squeak_changestamp' : 'ct 1/25/2024 18:59'
}
Object >> oragleDefaultQuery: nonShallow [

	^ Array streamContents: [:stream |
		self class allInstVarNames withIndexDo: [:name :index |
			| value serialized resultValue |
			value := self instVarAt: index.
			serialized := OragleProjects serialize: value ifNotPrimitiveObject: [Object].
			resultValue := serialized ~= Object
				ifTrue:
					["primitive"
					[serialized]]
				ifFalse:
					[nonShallow ifTrue:
						[[(OragleProjects
							resolveQuery: value oragleDefaultQuery
							for: value)
								removeKey: #_sqOriginalQuery;
								yourself]]].
			resultValue ifNotNil:
				[stream nextPut: name -> resultValue]].
		1 to: self basicSize do: [:index |
			| value serialized resultValue |
			value := self instVarAt: index.
			serialized := OragleProjects serialize: value ifNotPrimitiveObject: [Object].
			resultValue := serialized ~= Object
				ifTrue:
					["primitive"
					[serialized]]
				ifFalse:
					[nonShallow ifTrue:
						[[(OragleProjects
							resolveQuery: value oragleDefaultQuery
							for: value)
								removeKey: #_sqOriginalQuery;
								yourself]]].
			resultValue ifNotNil:
				[stream nextPut: index asString -> resultValue]]]
]

{
	#category : #'*Oragle-converting',
	#'squeak_changestamp' : 'ct 2/16/2024 18:31'
}
Object >> oragleNanToNil [
]
