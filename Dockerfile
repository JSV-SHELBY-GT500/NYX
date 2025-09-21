# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies for production
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Your app binds to a port specified by the PORT env var, which Cloud Run provides.
# Define the command to run your app
CMD [ "node", "src/server.js" ]