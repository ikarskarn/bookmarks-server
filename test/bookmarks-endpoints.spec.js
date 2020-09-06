const knex = require('knex')
const fixtures = require('./bookmarks-fixtures')
const app = require('../src/app')
//const { expect } = require('chai')

const { makeBookmarksArray } = require('./bookmarks-fixtures')
//const supertest = require('supertest')

describe('Bookmarks Endpoints', function() {
	let db;

	before('make knex instance', () => {
		db = knex({
			client: 'pg',
			connection: process.env.TEST_DB_URL,
		})
		app.set('db', db)
	})

	after('disconnect from db', () => db.destroy());
	afterEach('cleanup', () => db('bookmarks').truncate());
	before('clean the table', () => db('bookmarks').truncate());
//+



	describe(`GET /bookmarks`, () => {
		context(`Given no bookmarks`, () => {
			it(`responds with 200 and an empty list`, () => {
				return supertest(app)
				.get('/bookmarks')
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(200, [])
			})
		})

        context('Given there are bookmarks in the database', () => {
			const testBookmarks = makeBookmarksArray()

			beforeEach('insert bookmarks', () => {
				return db
				.into('bookmarks')
				.insert(testBookmarks)
			})
		
			it('responds with 200 and all of the bookmarks', () => {
				return supertest(app)
				.get('/bookmarks')
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(200, testBookmarks)
			})
		})
	})
//+
	describe(`GET /bookmarks/:id`, () => {
		context(`Given no bookmarks`, () => {
			it(`responds with 404`, () => {
				const bookmarkId = 123456
				return supertest(app)
				.get(`/bookmarks/${bookmarkId}`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(404, { error: { message: `Bookmark Not Found` } })
			})
		})

        context('Given there are bookmarks in the database', () => {
			const testBookmarks = makeBookmarksArray()

			beforeEach('insert bookmarks', () => {
				return db
				.into('bookmarks')
				.insert(testBookmarks)
			})

			it('responds with 200 and the specified bookmark', () => {
				const bookmarkId = 2
				const expectedBookmark = testBookmarks[bookmarkId - 1]
				return supertest(app)
				.get(`/bookmarks/${bookmarkId}`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(200, expectedBookmark)
			})
		})

		context(`Given an XSS attack bookmark`, () => {
			const maliciousBookmark = {
				id: 911,
				title: 'Naughty naughty very naughty <script>alert("xss");</script>',
				url: 'https://www.hackers.com',
				description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
				rating: 1,
			}
			const expectedBookmark = {
				...maliciousBookmark,
				title: 'Naughty naughty very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
				description: `Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`
			}

			beforeEach('insert malicious bookmark', () => {
				return db
				.into('bookmarks')
				.insert([ maliciousBookmark ])
			})

			it('removes XSS attack content', () => {
				return supertest(app)
				.get(`/bookmarks`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(200)
				.expect(res => {
					expect(res.body[0].title).to.eql(expectedBookmark.title)
					expect(res.body[0].description).to.eql(expectedBookmark.description)
				})
			})
		})
	})

	describe(`POST /bookmarks`, () => {
		it(`creates a bookmark, responding with 201 and the new bookmark`,  function() {
			const newBookmark = {
				id: 1,
				title: 'test new bookmark',
				url: 'http://www.google.com',
				description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Natus consequuntur deserunt commodi, nobis qui inventore corrupti iusto aliquid debitis unde non.Adipisci, pariatur.Molestiae, libero esse hic adipisci autem neque ?',
				rating: 2
			}
			return supertest(app)
			.post('/bookmarks')
			.send(newBookmark)
			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
			.expect(201)
			.expect(res => {
				expect(res.body.title).to.eql(newBookmark.title)
				expect(res.body.url).to.eql(newBookmark.url)
				expect(res.body.description).to.eql(newBookmark.description)
				expect(res.body.rating).to.eql(newBookmark.rating)
				expect(res.body).to.have.property('id')
				expect(res.headers.location).to.eql(`/bookmarks/${res.body.id}`)
				//const expected = new Date().toLocaleString()
				//const actual = new Date(res.body.date_published).toLocaleString()
				//expect(actual).to.eql(expected)
			})
			.then(res =>
				supertest(app)
				.get(`/bookmarks/${res.body.id}`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(res.body)
			)
		})

		it(`responds with 400 missing 'url' if not supplied`, () => {
			const newBookmarkMissingUrl = {
				id: 1,
				title: 'testTitle',
				// url: 'https://test.com',
				description: 'testDescription',
				rating: 1,
			}
			return supertest(app)
			.post(`/bookmarks`)
			.send(newBookmarkMissingUrl)
			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
			.expect(400, {
				error: { message: `'url' is required` }
			})
		})

		it(`responds with 400 missing 'rating' if not supplied`, () => {
			const newBookmarkMissingRating = {
				title: 'test-title',
				url: 'https://test.com',
				// rating: 1,
			}
			return supertest(app)
			.post(`/bookmarks`)
			.send(newBookmarkMissingRating)
			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
			.expect(400, {
				error: { message: `'rating' is required` }
			})
		})

		it(`responds with 400 invalid 'rating' if not between 0 and 5`, () => {
			const newBookmarkInvalidRating = {
				title: 'test-title',
				url: 'https://test.com',
				rating: 'invalid',
			}
			return supertest(app)
			.post(`/bookmarks`)
			.send(newBookmarkInvalidRating)
			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
			.expect(400, {
				error: { message: `'rating' must be a number between 0 and 5` }
			})
		})

		it(`responds with 400 invalid 'url' if not a valid URL`, () => {
			const newBookmarkInvalidUrl = {
				title: 'test-title',
				url: 'htp://invalid-url',
				rating: 1,
			}
			return supertest(app)
			.post(`/bookmarks`)
			.send(newBookmarkInvalidUrl)
			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
			.expect(400, {
				error: { message: `'url' must be a valid URL` }
			})
		})


	})

	describe(`DELETE /bookmarks/:id`, () => {
		context(`Given no bookmarks`, () => {
			it(`responds with 404`, () => {
				const bookmarkId = 123456
				return supertest(app)
				.delete(`/bookmarks/${bookmarkId}`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(404, { error: { message: `Bookmark Not Found` } })
			})
		})

		context('Given there are bookmarks in the database', () => {
			const testBookmarks = makeBookmarksArray()
			
            beforeEach('insert bookmarks', () => {
				return db
				.into('bookmarks')
				.insert(testBookmarks)
			})

			it('responds with 204 and removes the bookmark', () => {
				const idToRemove = 2
				const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove)
				return supertest(app)
				.delete(`/bookmarks/${idToRemove}`)
				.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
				.expect(204)
				.then(res =>
					supertest(app)
					.get(`/bookmarks`)
					.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
					.expect(expectedBookmarks)
				)
			})
		})
	})
})