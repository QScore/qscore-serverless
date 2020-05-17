
Welcome to the QScore Serverless project!
  
QScore is a fun new way to encourage social distancing together with your friends.    
* Earn points for staying home  
* Add your friends to see their scores.    
* Customize your avatar with Giphy  
* Compare scores on leaderboards  
* Track your 24-hour progress  

## About
This project contains the backend implementation for QScore.  It is built to run using the [Serverless Framework](https://serverless.com) with AWS.

## Setup
QScore Serverless requires a [Firebase project](https://firebase.google.com/docs/admin/setup) for authentication.

First, add in a `./environment.json` file with the following information.  `SECRET_KEY` is a 256-bit AES cryptographic key
```json
{
  "FIREBASE_DATABASE_URL": "[FIREBASE_DATABASE_URL]",
  "SECRET_KEY": "[SECRET_KEY]",
}
```

Next, add your `serviceAccount.json` file to `src/auth` directory.

## Running the server locally
Install serverless framework:
```bash
npm install -g serverless
```
  
In the root of the project, install dependencies
```bash
npm install
```

Run the server offline
```bash
sls offline start
```

## Contributors  
* [polson](https://github.com/polson)  
  
  
## License  
```
Copyright 2020 Continuum Mobile Software, LLC    
 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:    
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.    
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
 ```