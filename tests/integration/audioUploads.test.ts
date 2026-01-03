import { describe, it, expect} from 'vitest'
import app from '../../audio-upload-api/src/index'

const validSubmission = {
  service: 'test_service', 
  season: 'test_season',
  hymn_title: 'test',
  language: ['English', 'Coptic', 'Arabic'],
  audio_object_key: 'test.wav',
  checked_updates: true,
  email: 'test@example.com',
  status: 'test_status'
}

describe('POST /create-submission', () => {
  it('creates an audio upload to DB', async () => {
    const res = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(validSubmission)
    })
    expect(res.status).toBe(200)
  })

  it('reject a duplicate email submission', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`

    const body = {
      service: 'test_service', 
      season: 'test_season',
      hymn_title: 'test',
      language: ['English', 'Coptic', 'Arabic'],
      audio_object_key: 'test.wav',
      checked_updates: true,
      email: uniqueEmail,
      status: 'test_status'
    }

    const first = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
    expect(first.status).toBe(200)

    const second = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
    expect(second.status).toBe(409)
  })

  it('reject a missing email when checked_updates is true', async () => {
    const {email, ...bodyWithoutEmail} = validSubmission
    const res = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...bodyWithoutEmail, checked_updates: true})
    })
    expect(res.status).toBe(400)
  })

  it('allows a missing email when checked_updates is false', async () => {
    const {email, ...bodyWithoutEmail} = validSubmission
    const res = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...bodyWithoutEmail, checked_updates: false})
    })
    expect(res.status).toBe(200)
  })

  // Testing if an audio file was uploaded by rejecting the request if audio object key is missing.
  it('reject a missing audio object key', async () => {
    const {audio_object_key, ...bodyWithoutAudioObjectKey} = validSubmission
    const res = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...bodyWithoutAudioObjectKey})
    })
    expect(res.status).toBe(400)
  })

  it('reject if missing languages used when audio file attached and hymn title entered ', async () => {
    const {language, ...bodyWithoutLanguage} = validSubmission
    const res = await app.request('/create-submission', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...bodyWithoutLanguage})
    })
    expect(res.status).toBe(400)
  })
})