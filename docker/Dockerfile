FROM nginx:alpine

WORKDIR /etc/nginx
COPY ./nginx.conf /etc/nginx/nginx.conf

EXPOSE 8384
EXPOSE 80
EXPOSE 8380

ENTRYPOINT [ "nginx" ]
CMD [ "-g", "daemon off;" ]