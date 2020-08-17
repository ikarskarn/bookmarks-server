const bookmarks = [{
	id: 1,
    title: 'Bookmark One',
    url: 'http://www.google.com',
    description: 'this is Bookmark 1',
	rating: '4'
}];

const lists = [{
    id: 1,
    header: 'Bookmarks List One',
    bookmarkIds: [1]
}];

module.exports = { bookmarks, lists }