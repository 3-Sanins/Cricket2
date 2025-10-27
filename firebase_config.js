

const firebaseConfig = {
  apiKey: "AIzaSyDBhHt1wbY-gwlmUYkLSWblqgs8sptCWps",
  authDomain: "cricket-f3711.firebaseapp.com",
  databaseURL: "https://cricket-f3711-default-rtdb.firebaseio.com",
  projectId: "cricket-f3711",
  storageBucket: "cricket-f3711.firebasestorage.app",
  messagingSenderId: "84308127741",
  appId: "1:84308127741:web:9d7cc9843558d4d053b394"
};


firebase.initializeApp(firebaseConfig);
const database = firebase.database();
database.ref('test').set('Hello')
  .then(() => console.log('Test saved successfully'))
  .catch(error => console.error('Error: ', error));