#!/bin/bash -e

install -m 755 files/resize2fs_once	"${ROOTFS_DIR}/etc/init.d/"

install -d				"${ROOTFS_DIR}/etc/systemd/system/rc-local.service.d"
install -m 644 files/ttyoutput.conf	"${ROOTFS_DIR}/etc/systemd/system/rc-local.service.d/"

install -m 644 files/50raspi		"${ROOTFS_DIR}/etc/apt/apt.conf.d/"

install -m 644 files/console-setup   	"${ROOTFS_DIR}/etc/default/"

install -m 755 files/rc.local		"${ROOTFS_DIR}/etc/"

# disable wireless
install -m 644 files/raspi-blacklist.conf "${ROOTFS_DIR}/etc/modprobe.d/"

install -m 644 files/frc.json "${ROOTFS_DIR}/boot/"

install -m 755 extfiles/setuidgids "${ROOTFS_DIR}/usr/local/bin/"

install -m 755 -o 1000 -g 1000 extfiles/multiCameraServer "${ROOTFS_DIR}/home/pi/"

cat extfiles/jdk_11.0.1-strip.tar.gz | sh -c "mkdir -p ${ROOTFS_DIR}/usr/lib/jvm && cd ${ROOTFS_DIR}/usr/lib/jvm/ && tar xzf - --exclude=\*.diz --exclude=src.zip --transform=s/^jdk/jdk-11.0.1/"
cp files/jdk-11.0.1.jinfo "${ROOTFS_DIR}/usr/lib/jvm/.jdk-11.0.1.jinfo"

on_chroot << EOF
cd /usr/lib/jvm
grep /usr/lib/jvm .jdk-11.0.1.jinfo | awk '{ print "update-alternatives --install /usr/bin/" \$2 " " \$2 " " \$3 " 2"; }' | bash
update-java-alternatives -s jdk-11.0.1
EOF

on_chroot << EOF
rm -rf /var/lib/dhcp/ /var/run /var/spool /var/lock
ln -s /tmp /var/lib/dhcp
ln -s /run /var/run
ln -s /tmp /var/spool
ln -s /tmp /var/lock
sed -i -e 's/d \/var\/spool/#d \/var\/spool/' /usr/lib/tmpfiles.d/var.conf
sed -i -e 's/\/var\/lib\/ntp/\/var\/tmp/' /etc/ntp.conf
EOF

cat files/bash.bashrc >> "${ROOTFS_DIR}/etc/bash.bashrc"

cat files/bash.logout >> "${ROOTFS_DIR}/etc/bash.bash_logout"

on_chroot << EOF
systemctl enable ssh
systemctl enable regenerate_ssh_host_keys
EOF

if [ "${USE_QEMU}" = "1" ]; then
	echo "enter QEMU mode"
	install -m 644 files/90-qemu.rules "${ROOTFS_DIR}/etc/udev/rules.d/"
	on_chroot << EOF
systemctl disable resize2fs_once
EOF
	echo "leaving QEMU mode"
else
	on_chroot << EOF
systemctl enable resize2fs_once
EOF
fi

on_chroot << \EOF
for GRP in input spi i2c gpio; do
	groupadd -f -r "$GRP"
done
for GRP in adm dialout cdrom audio users sudo video games plugdev input gpio spi i2c netdev; do
  adduser pi $GRP
done
EOF

on_chroot << EOF
setupcon --force --save-only -v
EOF

on_chroot << EOF
usermod --pass='*' root
EOF

install -m 644 files/ld.so.conf.d/*.conf "${ROOTFS_DIR}/etc/ld.so.conf.d/"

install -v -d "${ROOTFS_DIR}/usr/local/frc/lib"

cat extfiles/libopencv.tar.gz | sh -c "cd ${ROOTFS_DIR}/usr/local/frc/lib/ && tar xzf -"

install -m 755 extfiles/cv2.*.so "${ROOTFS_DIR}/usr/local/lib/python3.5/dist-packages/"

install -m 755 extfiles/libwpiutil*.so* "${ROOTFS_DIR}/usr/local/frc/lib/"
install -m 755 extfiles/libcscore*.so* "${ROOTFS_DIR}/usr/local/frc/lib/"
install -m 755 extfiles/libntcore*.so* "${ROOTFS_DIR}/usr/local/frc/lib/"
install -m 755 extfiles/libcameraserver*.so* "${ROOTFS_DIR}/usr/local/frc/lib/"

install -v -d "${ROOTFS_DIR}/usr/local/frc/include"

cat extfiles/wpiutil-include.tar.gz | sh -c "cd ${ROOTFS_DIR}/usr/local/frc/include/ && tar xzf -"
cat extfiles/cscore-include.tar.gz | sh -c "cd ${ROOTFS_DIR}/usr/local/frc/include/ && tar xzf -"
cat extfiles/ntcore-include.tar.gz | sh -c "cd ${ROOTFS_DIR}/usr/local/frc/include/ && tar xzf -"
cat extfiles/cameraserver-include.tar.gz | sh -c "cd ${ROOTFS_DIR}/usr/local/frc/include/ && tar xzf -"

install -v -o 1000 -g 1000 -d "${ROOTFS_DIR}/home/pi/java-example/"
install -m 644 -o 1000 -g 1000 extfiles/*.jar "${ROOTFS_DIR}/home/pi/"

on_chroot << EOF
ldconfig
EOF

install -v -d "${ROOTFS_DIR}/service/configServer"

install -m 755 files/configServer_run "${ROOTFS_DIR}/service/configServer/run"

install -m 755 extfiles/rpiConfigServer "${ROOTFS_DIR}/usr/local/sbin/configServer"

install -m 755 extfiles/netconsoleServer "${ROOTFS_DIR}/usr/local/bin/"

install -v -d "${ROOTFS_DIR}/service/camera"

install -m 755 files/camera_run "${ROOTFS_DIR}/service/camera/run"

on_chroot << EOF
cd /service/camera && rm -f supervise && ln -s /tmp/camera-supervise supervise
cd /service/configServer && rm -f supervise && ln -s /tmp/configServer-supervise supervise
cd /etc/service && rm -f camera && ln -s /service/camera .
cd /etc/service && rm -f configServer && ln -s /service/configServer .
EOF

install -m 755 -o 1000 -g 1000 files/runCamera "${ROOTFS_DIR}/home/pi/"
install -m 755 -o 1000 -g 1000 files/runInteractive "${ROOTFS_DIR}/home/pi/"
install -m 755 -o 1000 -g 1000 files/runService "${ROOTFS_DIR}/home/pi/"

rm -f "${ROOTFS_DIR}/etc/ssh/"ssh_host_*_key*
