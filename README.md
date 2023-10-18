# Online Computation Tool for Method of Equal Shares

This is a simple web app where a user can load a participatory budgeting voting file (in the `.pb` format from [pabulib](http://pabulib.org/)), and compute the outcome using the Method of Equal Shares. The computation happens offline on the user's device, and no data is being uploaded. The tool supports several variants of the Method of Equal Shares, which can be customized. 

The tool is intended for citizens who want to verify the computation of voting results in a city that uses the Method of Equal Shares for participatory budgeting. But it can also be used by election officials and municipal adminstrators to determine or to double check the winning projects. Finally, it can be used as a research tool.

General information about how to compute the Method of Equal Shares, and in particular about alternatives to this tool, are available at [https://equalshares.net/implementation/computation/](https://equalshares.net/implementation/computation/).

## Deployed on [equalshares.net](https://equalshares.net/tools/compute/).

The tool is available online at [https://equalshares.net/tools/compute/](https://equalshares.net/tools/compute/).

<a href="https://equalshares.net/tools/compute/">
<img width="500" alt="image" src="https://github.com/equalshares/equalshares-compute-tool/assets/3543224/29f36e75-c58d-4c5d-8681-372fb0a50234">
</a>

## Install

For most users, we recommend you use the public version of the tool linked above. No data is uploaded by the tool (and after loading the webpage, one could even disconnect the internet connection). However, the tool can be downloaded and run on your own server, if you desire. There are no dependencies, the tool uses only HTML, CSS, and JavaScript. You can simply [download the repository as a .zip file](https://github.com/equalshares/equalshares-compute-tool/archive/refs/heads/master.zip) and put the contents on any web server. You can also run it locally. For this, start a simple webserver by running a command like
```python
python3 -m http.server 8001
```
in the directory where you extracted the contents of this repository, and then go to http://localhost:8001 in your browser.

## Development and contribution

If you wish to improve the tool, contributions are welcome. Consider contacting Dominik Peters prior to starting work, but you can also just open a Pull Request. You can also report bugs and leave feature requests using the Issues tab of this repository.

The code in the files `pabulibParser.js` and `methodOfEqualSharesWorker.js` may be of independent interest.