module.exports = {
	"origin": "https://alloc-spike.local",
	"entry": "/",
	"router": {
		"alloc": [
			{
				"regexp": "^\\/(?:\\/)?$",
				"options": "i"
			},
			{
				"regexp": "^\\/alloc(?:\\/)?$",
				"options": "i"
			}
		]
	},
	"generate": {
		"worker": "common/workers"
	},
	"runtime": {
		"subpackagesMap": {},
		"tabBarMap": {},
		"usingComponents": {}
	},
	"pages": {
		"alloc": {}
	},
	"redirect": {},
	"optimization": {}
}