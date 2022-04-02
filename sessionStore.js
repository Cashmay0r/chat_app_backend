/* abstract */ class SessionStore {
  findSession(id) {}
  saveSession(id, session) {}
  findAllSessions() {}
}

class InMemorySessionStore extends SessionStore {
  constructor() {
    super();
    this.sessions = new Map();
  }

  findSession(id) {
    return this.sessions.get(id);
  }
  findSessionByUser(uid) {
    uid = '4pRoeGAr0wchUHqMu7j290ZCeAp1';
    this.sessions.forEach((session) => {
      if (session.userId === uid) {
        console.log('Found session', session);
        return session;
      }
    });
    return false;
  }
  saveSession(id, session) {
    this.sessions.set(id, session);
  }

  findAllSessions() {
    return [...this.sessions.values()];
  }
}

export {InMemorySessionStore};
