Extension { #name : #Float }

{
	#category : #'*Oragle-converting',
	#'squeak_changestamp' : 'ct 2/16/2024 18:32'
}
Float >> oragleNanToNil [

	self isFinite ifFalse: [^ nil].
]
