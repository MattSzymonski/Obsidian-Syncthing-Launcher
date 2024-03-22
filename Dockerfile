# Use a minimal Linux distribution as base image
FROM alpine:latest

# Install necessary packages to run executables
RUN apk add --no-cache libc6-compat

# Copy the syncthing folder from the host to the container
COPY ./syncthing /app/syncthing

# Copy the docker folder from the host to the container
COPY ./docker /app/docker

# Define the command to run when the container starts
CMD ["/app/syncthing/syncthing.exe"]