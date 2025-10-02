import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedRedactedToken = await deploy("RedactedToken", {
    from: deployer,
    log: true,
  });
  console.log(`RedactedToken contract: `, deployedRedactedToken.address);
};
export default func;
func.id = "deploy_redactedToken";
func.tags = ["RedactedToken"];

