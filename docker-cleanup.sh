#!/bin/bash
sudo docker container ls -a | awk '{if(NR!=1) print $NF;}'
sudo docker container rm `sudo docker container ls -a | awk '{if(NR!=1) print $NF;}'`
sudo docker volume prune
