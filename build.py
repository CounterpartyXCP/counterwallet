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
import subprocess
import stat

ADMIN_TEMPLATE_URL = "https://www.dropbox.com/s/jt2wzt48wdjjnqu/template_1.2.zip"

def usage():
    print("SYNTAX: %s [-h] [--cdn-build]" % sys.argv[0])

def runcmd(command, abort_on_failure=True):
    logging.debug("RUNNING COMMAND: %s" % command)
    ret = os.system(command)
    if abort_on_failure and ret != 0:
        logging.error("Command failed: '%s'" % command)
        sys.exit(1) 

def link_or_copy(is_cdn_build, src, dest):
    if is_cdn_build:
        runcmd("cp -a %s %s" % (src, dest))
    else:
        runcmd("ln -sf %s %s" % (src, dest))

def main():
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s|%(levelname)s: %(message)s')
    
    #parse any command line objects
    is_cdn_build = False
    try:
        opts, args = getopt.getopt(sys.argv[1:], "h", ["cdn-build", "help"])
    except getopt.GetoptError as err:
        usage()
        sys.exit(2)
    mode = None
    for o, a in opts:
        if o in ("--cdn-build",):
            is_cdn_build = True
        elif o in ("-h", "--help"):
            usage()
            sys.exit()
        else:
            assert False, "Unhandled or unimplemented switch or option"
    
    base_path = os.path.normpath(os.path.dirname(os.path.realpath(sys.argv[0])))
    logging.info("Building counterwallet for %s distribution..." % ("local server" if not is_cdn_build else "CDN"))
    
    #install required deps
    runcmd("sudo apt-get -y install wget unzip")
    
    #fetch admin template we use and unpack
    runcmd("rm -rf %s" % os.path.join(base_path, "build"))
    runcmd("rm -rf /tmp/ && wget -O /tmp/template.zip %s && unzip -d /tmp /tmp/template.zip" % ADMIN_TEMPLATE_URL)
    runcmd("mv /tmp/SmartAdmin_1.2/build %s" % os.path.join(base_path, "build"))
    runcmd("rm -rf /tmp/SmartAdmin_1.2")
    
    #remove the stuff we don't need from the build
    runcmd("rm -rf %s/ajax %s/goodies %s/HTML_version %s/php %s/*.php %s/*.html" % (
        base_path, base_path, base_path, base_path, base_path, base_path))
    
    #link/copy in the base counterwallet src dir into the build
    link_or_copy(is_cdn_build, os.path.join(base_path, "src"), os.path.join(base_path, "build", "xcp"))
    #replace the things that need to be replaced in the build
    #build/index.html
    #build/login.html
    #build/js/app.js
    

if __name__ == "__main__":
    main()
