# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json from backend folder
COPY backend/package*.json ./

# Install app dependencies
RUN npm install --omit=dev

# Bundle app source from backend folder
COPY backend .

# Define the command to run your app
CMD [ "node", "server.js" ]
