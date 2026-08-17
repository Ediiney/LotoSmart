@echo off
setlocal
cd /d E:\LotoSmart-work

echo.
echo Verificando patch LotoSmart V1.17.2...
git apply --check lotosmart-v1.17.2-product-fix.patch
if errorlevel 1 (
  echo.
  echo ERRO: o patch nao pode ser aplicado. Nenhum arquivo foi alterado.
  pause
  exit /b 1
)

echo.
echo Aplicando patch...
git apply lotosmart-v1.17.2-product-fix.patch
if errorlevel 1 (
  echo ERRO ao aplicar patch.
  pause
  exit /b 1
)

echo.
echo Patch aplicado com sucesso.
git status
echo.
echo Se o status estiver correto, execute:
echo git add .
echo git commit -m "hotfix: align product with v1.17.2 and restore contest data"
echo git push origin main
echo.
pause
