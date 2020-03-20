const vscode = require('vscode');
const shell = require('shelljs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Congratulations, your extension "s5" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand('s5.cipher', () => s5('cipher')));
	context.subscriptions.push(vscode.commands.registerCommand('s5.decipher', () => s5('decipher')));
	context.subscriptions.push(vscode.commands.registerCommand('s5.render', () => s5('render')));
}

exports.activate = activate;

function deactivate() {}

module.exports = {
	activate,
	deactivate
}

/**
 * @param {string} command
 */
function s5(command) {
	if (!shell.which('s5')) {
		vscode.window.showErrorMessage('s5 command not found in $PATH');
		return;
	}

	let config = vscode.workspace.getConfiguration('s5');
	let provider = config.get('provider');
	let cmd = 's5 ' + command + ' ' + provider;
	
	switch(provider) {
		case 'aes':
			cmd += ' --key=' + config.get('aes.key');
			break;
		case 'aws':
			if ( config.get('aws.accessKeyID').length > 0 ) {
				shell.env["AWS_ACCESS_KEY_ID"] = config.get('aws.accessKeyID');
			}

			if ( config.get('aws.secretAccessKey').length > 0 ) {
				shell.env["AWS_SECRET_ACCESS_KEY"] = config.get('aws.secretAccessKey');
			}

			if ( config.get('aws.sessionToken').length > 0 ) {
				shell.env["AWS_SESSION_TOKEN"] = config.get('aws.sessionToken');
			}

			cmd += ' --kms-key-arn=' + config.get('aws.kmsKeyARN');
			break;
		case 'gcp':
			cmd += ' --kms-key-name=' + config.get('gcp.kmsKeyName');
			break;
		case 'pgp':
			shell.env["S5_PGP_PUBLIC_KEY_PATH"] = config.get('pgp.publicKeyPath');
			shell.env["S5_PGP_PRIVATE_KEY_PATH"] = config.get('pgp.privateKeyPath');
			break;
		case 'vault':
			if ( config.get('vault.address').length > 0 ) {
				shell.env["VAULT_ADDRESS"] = config.get('vault.address');
			}
			
			if ( config.get('vault.token').length > 0 ) {
				shell.env["VAULT_TOKEN"] = config.get('vault.token');
			}

			cmd += ' --transit-key=' + config.get('vault.transitKey');
			break;
	}

	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('You need to select a document/text to cipher/decipher');
		return;
	}
	
	let document = editor.document;

	switch(command) {
		case 'cipher': case 'decipher':
			let selection = editor.selection;
			cmd += ' <<_EOL_\n' + document.getText(selection) + '\n_EOL_';
			shell.exec(
				cmd,
				function(code, stdout, stderr) {
					if (code !== 0) {
						vscode.window.showErrorMessage('s5 error : ' + cmd + ' - ' + stdout + ' - ' + stderr);
						return;
					} else {
						editor.edit(editBuilder => {
							editBuilder.replace(selection, stdout);
						});
					}
				}
			);
			break;
		case 'render':
			cmd += ' --in-place ' + document.uri.fsPath;
			vscode.window.showInformationMessage(cmd);
			shell.exec(
				cmd,
				function(code, stdout, stderr) {
					if (code !== 0) {
						vscode.window.showErrorMessage('s5 error : ' + cmd + ' - ' + stdout + ' - ' + stderr);
						return;
					}
				}
			);
			break;
		default:
			vscode.window.showErrorMessage('undefined command : ' + command);
			break;
	}
}
