
//this is just to create the skeleton and upload to github, can be removed
const buttonTest = document.getElementById("buttontTest");
let checker = true;
const buttonColor = () => {
    if(checker){
        document.body.style.backgroundColor = "red";
        checker = false;
    } else {
        document.body.style.backgroundColor = "white";
        checker = true;
    }
}

document.addEventListener("click", buttonColor);