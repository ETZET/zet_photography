import React from 'react';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import PhotographyApp from './components/PhotographyApp';

function App({ signOut, user }) {
  console.log('App component rendered', { user });
  return (
    <div>
      <PhotographyApp signOut={signOut} user={user} />
    </div>
  );
}

export default App;