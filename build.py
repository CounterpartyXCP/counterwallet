#! /usr/bin/env python3
"""
Builds counterwallet site in build/ directory, ready to go (either for a CDN type setup, or locally hosted)

************ NOTE: CURRENTLY WORKS FOR UBUNTU LINUX 13.10 ONLY! ************
"""
import os
import sys
import getopt
import logging
import shutil
import urllib
import zipfile
import platform
import tempfile
import glob
import subprocess
import stat

SITE_TEMPLATE_URL = "https://www.dropbox.com/s/4hjr517h6h7qbk9/template_1.3.zip"
SITE_TEMPLATE_DIR = "SmartAdmin_1_3/DEVELOPER/AJAX_version" #subdir under /tmp once unzipped (do not start with slash)

def usage():
    print("SYNTAX: %s [-h] [--copy]" % sys.argv[0])

def runcmd(command, abort_on_failure=True):
    logging.debug("RUNNING COMMAND: %s" % command)
    ret = os.system(command)
    if abort_on_failure and ret != 0:
        logging.error("Command failed: '%s'" % command)
        sys.exit(1) 

def link_or_copy(copy_files, src, dest):
    if copy_files: 
        runcmd("cp -af %s %s" % (src, dest))
    else: #link over files, instead of copying, so that we can edit in place
        runcmd("ln -sf %s %s" % (src, dest))

def do_prerun_checks():
    #make sure this is running on a supported OS
    if os.name != "posix" or platform.dist()[0] != "Ubuntu" or platform.architecture()[0] != '64bit':
        logging.error("Only 64bit Ubuntu Linux is supported at this time")
        sys.exit(1)
    ubuntu_release = platform.linux_distribution()[1]
    if ubuntu_release != "13.10":
        logging.error("Only Ubuntu 13.10 supported for counterwalletd install.")
    #script must be run as root
    if os.geteuid() != 0:
        logging.error("This script must be run as root (use 'sudo' to run)")
        sys.exit(1)
    if os.name == "posix" and "SUDO_USER" not in os.environ:
        logging.error("Please use `sudo` to run this script.")

def main():
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s|%(levelname)s: %(message)s')
    
    #parse any command line objects
    copy_files = False
    try:
        opts, args = getopt.getopt(sys.argv[1:], "h", ["copy", "help"])
    except getopt.GetoptError as err:
        usage()
        sys.exit(2)
    for o, a in opts:
        if o in ("--copy",):
            copy_files = True #copy files instead of linking to them
        elif o in ("-h", "--help"):
            usage()
            sys.exit()
        else:
            assert False, "Unhandled or unimplemented switch or option"
    
    do_prerun_checks()

    base_path = os.path.normpath(os.path.dirname(os.path.realpath(sys.argv[0])))
    run_as_user = os.environ["SUDO_USER"]
    assert run_as_user
    
    logging.info("Building counterwallet for %s distribution..." % ("local server" if not copy_files else "CDN"))
    
    #install required deps
    runcmd("apt-get -y install git-core wget unzip rsync")

    cw_site_path = os.path.join(base_path, "build")
    #remove existing SmartAdmin build dir (as it's not a git repo...just a dumb copy)
    runcmd("rm -rf %s" % cw_site_path) 
    #fetch admin template we use and unpack
    runcmd("rm -rf /tmp/template.zip /tmp/%s" % SITE_TEMPLATE_DIR) #just in case...
    runcmd("wget -O /tmp/template.zip %s && unzip -d /tmp /tmp/template.zip" % SITE_TEMPLATE_URL)
    #remove the stuff we don't need from the build
    site_template_unpack_base = "/tmp/%s" % SITE_TEMPLATE_DIR
    to_remove = [
        "%s/ajax" % site_template_unpack_base,
        "%s/php" % site_template_unpack_base,
        "%s/*.php" % site_template_unpack_base,
        "%s/*.html" % site_template_unpack_base,
        "%s/js/demo.js" % site_template_unpack_base,
        "%s/css/demo.css" % site_template_unpack_base,
        "%s/css/invoice.css" % site_template_unpack_base,
        "%s/css/lockscreen.css" % site_template_unpack_base,
        "%s/css/your_style.css" % site_template_unpack_base,
    ]
    runcmd("rm -rf %s" % ' '.join(to_remove))
    runcmd("mv %s %s" % (site_template_unpack_base, cw_site_path)) #merge with the repo files (if on master)
    runcmd("rm -rf /tmp/template.zip /tmp/%s" % SITE_TEMPLATE_DIR.split('/')[0]) #don't need this anymore...
    
    #link/copy in the base counterwallet src dir into the build
    link_or_copy(copy_files, os.path.join(base_path, "src"), os.path.join(cw_site_path, "xcp"))
    #replace the things that need to be replaced in the build
    link_or_copy(copy_files, os.path.join(base_path, "src", "pages", "index.html"), os.path.join(cw_site_path, "index.html"))
    link_or_copy(copy_files, os.path.join(base_path, "src", "robots.txt"), os.path.join(cw_site_path, "robots.txt"))
    #x-editable's clear.png so we don't get a 404...
    link_or_copy(copy_files, os.path.join(base_path, "src", "images", "clear.png"), os.path.join(cw_site_path, "img", "clear.png"))
    runcmd("chown -R %s %s" % (run_as_user, cw_site_path)) #to chown the stuff the script made
    
    #runcmd("npm install -g bower")
    #TODO: move to bower and grunt-useman for a) auto installation of the javascript dependencies in
    # extjs (we can't do much about the smartadmin ones), and b) automatic gathering/minification of js and css resources
    # and c) replacement of the <script> and <stylesheet> tag templates as necessary to switch between debug and minified builds
    # (or, we just link to the same js/css files, and the files contain either full or minified content...either approach works) 
    

if __name__ == "__main__":
    main()
